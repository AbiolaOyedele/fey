import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { destroyCloudinaryAssetById, parseCloudinaryUrl } from '@/lib/cloudinary-server'
import { ALLOWED_UPLOAD_EXTENSIONS } from '@/lib/constants'
import { createServiceClient } from '@/lib/supabase-server'
import { notify } from '@/services/notifications.service'
import { announceToClient } from '@/services/portal-notifications.service'
import * as repo from '@/repositories/task-review.repository'
import * as taskRepo from '@/repositories/work-tasks.repository'
import { MAX_REVIEW_VERSIONS } from '@/types/task-review'
import type { ReviewAuthorType, ReviewComment, ReviewVersion } from '@/types/task-review'

/**
 * The Review tab's business rules.
 *
 * Two things live here rather than in the database:
 *
 *  1. **Superseding.** A new upload doesn't sit alongside the last one — it
 *     replaces it. Earlier versions stay readable as history but are stamped
 *     superseded, so "which file is the deliverable" always has one answer.
 *
 *  2. **The three-version cap.** Past three, the oldest version is deleted and
 *     its Cloudinary asset destroyed. A trigger can't do the second half, and
 *     dropping the row without the binary would leave storage growing forever —
 *     which is the whole reason for the cap.
 *
 * Both the app and the portal come through here, so the rules can't differ by
 * caller. Who is allowed to reach it is decided before this point: RLS for the
 * app, the portal service's contact fence for clients.
 */

/**
 * Upper bound on files in one version. Generous — several deliverables plus
 * their sources — but bounded so a stray multi-select can't write hundreds of
 * rows in a single request.
 */
const MAX_FILES_PER_VERSION = 20

const fileSchema = z.object({
  file_name: z.string().trim().min(1, 'That file needs a name.').max(300),
  file_url: z.string().url('That file could not be read.'),
  public_id: z.string().min(1),
  file_size: z.number().int().min(0).nullable().optional(),
  file_type: z.string().max(100).nullable().optional(),
})

/** A version is one or more files uploaded together. */
const versionSchema = z.object({
  files: z.array(fileSchema)
    .min(1, 'Add at least one file.')
    .max(MAX_FILES_PER_VERSION, `A version can hold up to ${MAX_FILES_PER_VERSION} files.`),
})

const commentSchema = z.object({
  body: z.string().trim().min(1, 'Add a note before sending.').max(5000),
  decision: z.enum(['approved', 'changes_requested']).nullable().optional(),
})

export interface ReviewActor {
  /** Set for a teammate. */
  userId?: string | null
  /** Set for a portal client. */
  portalUserId?: string | null
  name: string | null
  type: ReviewAuthorType
}


/**
 * Tells everyone attached to a task what just happened in its Review tab.
 *
 * Two audiences, one call — the same split the rest of the task system uses:
 * the people on the task inside the app (creator + assignees, minus whoever
 * did it), and the client in their portal when the task is theirs. A client
 * uploading a revision should reach the team, and the team approving should
 * reach the client, so both directions go through here.
 *
 * Never throws: an announcement failing must not fail the upload or the ruling
 * that triggered it.
 */
async function announceReviewEvent(args: {
  taskId: string
  ownerId: string
  workspaceId: string | null
  contactId: string | null
  actor: ReviewActor
  type: 'task_review_uploaded' | 'task_review_decided'
  headline: string
  detail: string
}): Promise<void> {
  const link = `/tasks?taskId=${args.taskId}`
  try {
    const db = createServiceClient()
    const participants = await taskRepo.getTaskParticipants(db, args.taskId)
    // A teammate doesn't need telling about their own action. A client action
    // has no auth user, so nobody is filtered out and the whole team hears it.
    const recipients = participants.filter((id) => id !== (args.actor.userId ?? ''))
    if (recipients.length > 0) {
      await notify({
        db,
        recipientIds: recipients,
        workspaceId: args.workspaceId,
        actorId: args.actor.userId ?? null,
        type: args.type,
        title: args.headline,
        body: args.detail,
        link,
        entityType: 'task',
        entityId: args.taskId,
      })
    }
    // The client hears about it unless they were the one who did it.
    if (args.contactId && args.actor.type !== 'client') {
      announceToClient({
        contactId: args.contactId,
        ownerId: args.ownerId,
        type: 'task',
        title: args.headline,
        body: args.detail,
        link,
        entityType: 'task',
        entityId: args.taskId,
      })
    }
  } catch { /* best-effort */ }
}

export async function listReviews(db: SupabaseClient, taskId: string): Promise<ReviewVersion[]> {
  return repo.listReviews(db, taskId)
}

/**
 * Records a new version of the deliverable.
 *
 * Pruning happens after the insert, never before: if cleanup fails we would
 * rather keep an extra file than have dropped the old one and then failed to
 * store the new one.
 */
export async function addVersion(
  db: SupabaseClient,
  taskId: string,
  input: unknown,
  actor: ReviewActor,
): Promise<{ version: ReviewVersion; pruned: number[] }> {
  const task = await taskRepo.getTaskCore(db, taskId)
  if (!task) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')

  const parsed = versionSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That file could not be added.', 'REVIEW_VERSION_INVALID')
  }
  const { files } = parsed.data

  // Defence in depth, same as task attachments: the browser checked each
  // extension before uploading, but the metadata write must not trust it. One
  // bad file rejects the whole version rather than silently dropping it — a
  // half-recorded deliverable is worse than a failed upload.
  for (const f of files) {
    const ext = f.file_name.split('.').pop()?.toLowerCase() ?? ''
    if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
      throw new AppError(422, `"${f.file_name}" is not an allowed file type.`, 'REVIEW_VERSION_INVALID_TYPE')
    }
  }

  // Version numbers never rewind, even after pruning, so "v4" stays "v4".
  const nextVersion = (await repo.highestVersion(db, taskId)) + 1

  const { id } = await repo.insertReview(db, {
    task_id: taskId,
    owner_id: task.owner_id,
    version: nextVersion,
    uploaded_by: actor.userId ?? null,
    uploaded_by_portal_user: actor.portalUserId ?? null,
    uploader_name: actor.name,
  })

  await repo.insertReviewFiles(db, files.map((f, i) => ({
    review_id: id,
    task_id: taskId,
    file_name: f.file_name,
    file_url: f.file_url,
    public_id: f.public_id,
    file_size: f.file_size ?? null,
    file_type: f.file_type ?? null,
    sort_order: i,
  })))

  await repo.supersedeEarlier(db, taskId, nextVersion)
  const pruned = await pruneOldVersions(db, taskId)

  const created = await repo.getReview(db, id)
  if (!created) throw new AppError(500, 'That version could not be saved.', 'REVIEW_VERSION_MISSING')

  await announceReviewEvent({
    taskId,
    ownerId: task.owner_id,
    workspaceId: task.workspace_id,
    contactId: task.contact_id,
    actor,
    type: 'task_review_uploaded',
    headline: nextVersion === 1 ? 'Work ready for review' : 'A new version is ready for review',
    detail: `${task.title} — v${nextVersion}, ${files.length} file${files.length === 1 ? '' : 's'} from ${actor.name ?? 'someone'}`,
  })

  return { version: created, pruned }
}

/**
 * Enforces the cap, oldest first. Returns the version numbers removed.
 *
 * A Cloudinary failure is logged, not thrown: the row is already gone and the
 * user's upload succeeded, so failing their request over an orphaned binary
 * would be the wrong trade. Same stance as deleteTaskFile.
 */
async function pruneOldVersions(db: SupabaseClient, taskId: string): Promise<number[]> {
  const all = await repo.listVersionsAsc(db, taskId)
  const excess = all.length - MAX_REVIEW_VERSIONS
  if (excess <= 0) return []

  const doomed = all.slice(0, excess)
  const removed: number[] = []

  for (const row of doomed) {
    // Read the files before the row goes — ON DELETE CASCADE takes the child
    // rows with it, and we still need their public_ids to free the storage.
    const files = row.work_task_review_files ?? []
    await repo.deleteReviewRow(db, row.id)
    removed.push(row.version)

    for (const f of files) {
      const resourceType = parseCloudinaryUrl(f.file_url)?.resourceType ?? 'image'
      const cleaned = await destroyCloudinaryAssetById(f.public_id, resourceType)
      if (!cleaned) {
        console.warn('[taskReview] Cloudinary cleanup failed for pruned version', {
          taskId, version: row.version, publicId: f.public_id,
        })
      }
    }
  }
  return removed
}

/**
 * Adds a note to a version, and applies its ruling to that version if it
 * carries one.
 *
 * The ruling is written to the version rather than derived from the latest note
 * so that a plain comment after an approval doesn't quietly un-approve it.
 */
export async function addComment(
  db: SupabaseClient,
  taskId: string,
  reviewId: string,
  input: unknown,
  actor: ReviewActor,
): Promise<ReviewComment> {
  const task = await taskRepo.getTaskCore(db, taskId)
  if (!task) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')

  const review = await repo.getReview(db, reviewId)
  if (!review || review.task_id !== taskId) {
    throw new AppError(404, 'That version could not be found.', 'REVIEW_VERSION_NOT_FOUND')
  }

  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That note could not be added.', 'REVIEW_COMMENT_INVALID')
  }
  const d = parsed.data

  // Reviewing a version that has already been replaced would rule on the wrong
  // file — the point of superseding is that there's one current deliverable.
  if (d.decision && review.superseded_at) {
    throw new AppError(409, 'That version has been replaced by a newer one.', 'REVIEW_VERSION_SUPERSEDED')
  }

  const comment = await repo.insertComment(db, {
    review_id: reviewId,
    task_id: taskId,
    owner_id: task.owner_id,
    author_id: actor.userId ?? null,
    author_portal_user: actor.portalUserId ?? null,
    author_name: actor.name,
    author_type: actor.type,
    body: d.body,
    decision: d.decision ?? null,
  })

  if (d.decision) {
    await repo.setReviewStatus(db, reviewId, d.decision)
    await announceReviewEvent({
      taskId,
      ownerId: task.owner_id,
      workspaceId: task.workspace_id,
      contactId: task.contact_id,
      actor,
      type: 'task_review_decided',
      headline: d.decision === 'approved' ? 'Work approved' : 'Changes requested',
      detail: `${task.title} — v${review.version}, by ${actor.name ?? 'someone'}`,
    })
  }

  return comment
}
