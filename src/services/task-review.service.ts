import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { destroyCloudinaryAssetById, parseCloudinaryUrl } from '@/lib/cloudinary-server'
import { ALLOWED_UPLOAD_EXTENSIONS } from '@/lib/constants'
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

const versionSchema = z.object({
  file_name: z.string().trim().min(1, 'That file needs a name.').max(300),
  file_url: z.string().url('That file could not be read.'),
  public_id: z.string().min(1),
  file_size: z.number().int().min(0).nullable().optional(),
  file_type: z.string().max(100).nullable().optional(),
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
  const d = parsed.data

  // Defence in depth, same as task attachments: the browser checked the
  // extension before uploading, but the metadata write must not trust it.
  const ext = d.file_name.split('.').pop()?.toLowerCase() ?? ''
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppError(422, 'That file type is not allowed.', 'REVIEW_VERSION_INVALID_TYPE')
  }

  // Version numbers never rewind, even after pruning, so "v4" stays "v4".
  const nextVersion = (await repo.highestVersion(db, taskId)) + 1

  const { id } = await repo.insertReview(db, {
    task_id: taskId,
    owner_id: task.owner_id,
    version: nextVersion,
    file_name: d.file_name,
    file_url: d.file_url,
    public_id: d.public_id,
    file_size: d.file_size ?? null,
    file_type: d.file_type ?? null,
    uploaded_by: actor.userId ?? null,
    uploaded_by_portal_user: actor.portalUserId ?? null,
    uploader_name: actor.name,
  })

  await repo.supersedeEarlier(db, taskId, nextVersion)
  const pruned = await pruneOldVersions(db, taskId)

  const created = await repo.getReview(db, id)
  if (!created) throw new AppError(500, 'That version could not be saved.', 'REVIEW_VERSION_MISSING')
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
    await repo.deleteReviewRow(db, row.id)
    removed.push(row.version)
    const resourceType = parseCloudinaryUrl(row.file_url)?.resourceType ?? 'image'
    const cleaned = await destroyCloudinaryAssetById(row.public_id, resourceType)
    if (!cleaned) {
      console.warn('[taskReview] Cloudinary cleanup failed for pruned version', { taskId, version: row.version })
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

  if (d.decision) await repo.setReviewStatus(db, reviewId, d.decision)

  return comment
}
