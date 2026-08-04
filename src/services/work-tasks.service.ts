import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { createServiceClient } from '@/lib/supabase-server'
import { destroyCloudinaryAssetById, parseCloudinaryUrl } from '@/lib/cloudinary-server'
import { MAX_UPLOAD_BYTES, ALLOWED_UPLOAD_EXTENSIONS, taskDescriptionUploadFolder } from '@/lib/constants'
import { UPLOAD_ROOT_FOLDER } from '@/services/upload.service'
import { extractImageUrls } from '@/utils/imageTokens'
import type { Task, TaskFileRow, TaskScope } from '@/types/work-tasks'
import * as repo from '@/repositories/work-tasks.repository'
import * as wfRepo from '@/repositories/workflows.repository'
import { ensureDefaultWorkflow } from '@/services/workflows.service'
import { notify } from '@/services/notifications.service'
import { announceToClient } from '@/services/portal-notifications.service'

/** The bits of a task an announcement needs to reach the right people. */
interface TaskCore {
  id: string
  owner_id: string
  workspace_id: string | null
  contact_id: string | null
}

/**
 * Tells everyone attached to a task what just happened to it.
 *
 * Every task event goes through here, so the two audiences can't drift: the
 * people on the task inside the app (its creator plus every assignee — a change
 * usually matters most to whoever is NOT the one who made it), and the client in
 * their portal when the task is theirs.
 *
 * `recipients` is passed in rather than looked up here because a delete has to
 * collect them before the row goes. Never throws: an announcement failing must
 * not fail the change that triggered it.
 */
async function announceTaskEvent(args: {
  core: TaskCore
  recipients: string[]
  actorId: string
  /** What happened, e.g. 'Task updated'. */
  headline: string
  /** Usually the task title, with a note of what changed. */
  detail: string | null
  /** A deleted task has nothing left to open, so the link stays on the board. */
  gone?: boolean
}): Promise<void> {
  const { core, actorId, headline, detail, gone } = args
  const link = gone ? '/tasks' : `/tasks?taskId=${core.id}`
  try {
    const recipients = args.recipients.filter((id) => id !== actorId)
    if (recipients.length > 0) {
      await notify({
        db: createServiceClient(),
        recipientIds: recipients,
        workspaceId: core.workspace_id,
        actorId,
        type: gone ? 'task_deleted' : 'task_updated',
        title: headline,
        body: detail,
        link,
        entityType: 'task',
        entityId: core.id,
      })
    }
    if (core.contact_id) {
      announceToClient({
        contactId:  core.contact_id,
        ownerId:    core.owner_id,
        type:       'task',
        title:      headline,
        body:       detail,
        link,
        // A deleted task must not resolve to a deep link that 404s, so it
        // carries no entity and falls back to the board.
        entityType: gone ? null : 'task',
        entityId:   gone ? null : core.id,
      })
    }
  } catch { /* best-effort */ }
}

/** Everyone on the task right now: its creator plus every assignee. */
async function participantsOf(taskId: string): Promise<string[]> {
  try {
    return await repo.getTaskParticipants(createServiceClient(), taskId)
  } catch {
    return []
  }
}

/** Notify newly-added assignees (best-effort; never blocks the task write). */
async function notifyAssigned(
  core: TaskCore,
  addedIds: string[],
  title: string,
  actorId: string,
): Promise<void> {
  const recipients = addedIds.filter((id) => id !== actorId)
  if (recipients.length === 0) return
  try {
    await notify({
      db: createServiceClient(),
      recipientIds: recipients,
      workspaceId: core.workspace_id,
      actorId,
      type: 'task_assigned',
      title: 'New task assigned to you',
      body: title,
      link: `/tasks?taskId=${core.id}`,
      entityType: 'task',
      entityId: core.id,
    })
  } catch { /* best-effort */ }
}

/** Fields worth telling people about, and how to name them. */
const FIELD_LABELS = {
  title:             'title',
  description:       'description',
  priority:          'priority',
  start_date:        'start date',
  due_date:          'due date',
  estimated_minutes: 'estimate',
} as const

type WatchedField = keyof typeof FIELD_LABELS

/**
 * Which of the watched fields the update actually changes.
 *
 * Compared against the stored row rather than trusting the payload: the drawer
 * saves the whole form, and boards re-send `sort_order` on every drag, so
 * "field present in the request" would fire a notification for nothing.
 */
function changedFields(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): WatchedField[] {
  return (Object.keys(FIELD_LABELS) as WatchedField[])
    .filter((k) => patch[k] !== undefined && (patch[k] ?? null) !== (before[k] ?? null))
}

/** "title and due date" — a change list a person can read. */
function describeChanges(fields: WatchedField[]): string {
  const names = fields.map((f) => FIELD_LABELS[f])
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

interface Ctx {
  userId: string
  ownerId: string
  workspaceId: string | null
}

const prioritySchema = z.enum(['low', 'medium', 'high'])
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.').nullable().optional()

const createSchema = z.object({
  title: z.string().trim().min(1, 'Add a task title.').max(500),
  description: z.string().max(20000).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  visibility: z.enum(['personal', 'team']).optional(),
  stage_id: z.string().uuid().nullable().optional(),
  priority: prioritySchema.optional(),
  start_date: dateSchema,
  due_date: dateSchema,
  estimated_minutes: z.number().int().min(0).nullable().optional(),
  assignee_ids: z.array(z.string().uuid()).optional(),
})

const updateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20000).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  visibility: z.enum(['personal', 'team']).optional(),
  stage_id: z.string().uuid().nullable().optional(),
  priority: prioritySchema.optional(),
  start_date: dateSchema,
  due_date: dateSchema,
  estimated_minutes: z.number().int().min(0).nullable().optional(),
  logged_minutes: z.number().int().min(0).optional(),
  done: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

/**
 * Resolves who a task belongs to. project_id wins — a project already implies a
 * client, so contact_id is denormalized from it. A direct contact_id resolves
 * its owner. Otherwise it's a personal task owned by the active workspace owner.
 */
async function resolveLink(
  db: SupabaseClient,
  ctx: Ctx,
  projectId: string | null | undefined,
  contactId: string | null | undefined,
): Promise<{ owner_id: string; workspace_id: string | null; project_id: string | null; contact_id: string | null }> {
  if (projectId) {
    const meta = await repo.getProjectMeta(db, projectId)
    if (!meta) throw new AppError(404, 'That project could not be found.', 'TASK_PROJECT_NOT_FOUND')
    return { owner_id: meta.owner_id, workspace_id: meta.workspace_id, project_id: projectId, contact_id: meta.contact_id }
  }
  if (contactId) {
    const c = await repo.getContactOwner(db, contactId)
    if (!c) throw new AppError(404, 'That client could not be found.', 'TASK_CONTACT_NOT_FOUND')
    return { owner_id: c.owner_id, workspace_id: ctx.workspaceId, project_id: null, contact_id: contactId }
  }
  return { owner_id: ctx.ownerId, workspace_id: ctx.workspaceId, project_id: null, contact_id: null }
}

/** First stage of the relevant workflow, so a new task lands in a board column. */
async function defaultStageId(db: SupabaseClient, ownerId: string, workspaceId: string | null, projectId: string | null): Promise<string | null> {
  let workflowId: string | null = null
  if (projectId) workflowId = await wfRepo.getProjectWorkflowId(db, projectId)
  if (workflowId) {
    const wf = await wfRepo.getWorkflowById(db, workflowId)
    if (wf?.stages.length) return wf.stages[0].id
  }
  const def = await ensureDefaultWorkflow(db, ownerId, workspaceId)
  return def.stages[0]?.id ?? null
}

export async function listTasks(
  db: SupabaseClient,
  ownerId: string,
  opts: {
    scope: TaskScope
    projectId?: string | null
    contactId?: string | null
    done?: boolean
    /** Caller identity + admin flag, for role-scoped visibility on the `all` scope. */
    viewer?: { id: string; isAdmin: boolean }
  },
): Promise<Task[]> {
  return repo.listTasks(db, {
    ownerId,
    scope: opts.scope,
    projectId: opts.projectId ?? null,
    contactId: opts.contactId ?? null,
    ...(opts.done !== undefined ? { done: opts.done } : {}),
    ...(opts.viewer ? { viewer: opts.viewer } : {}),
  })
}

export async function getTask(db: SupabaseClient, id: string): Promise<Task> {
  const task = await repo.getTaskById(db, id)
  if (!task) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  return task
}

export async function createTask(db: SupabaseClient, ctx: Ctx, input: unknown): Promise<Task> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid task.', 'TASK_INVALID')
  const d = parsed.data

  const link = await resolveLink(db, ctx, d.project_id, d.contact_id)
  const stageId = d.stage_id ?? await defaultStageId(db, link.owner_id, link.workspace_id, link.project_id)

  // Linked tasks (client/project) are workspace-visible regardless; for unlinked
  // tasks the caller picks personal vs team.
  const visibility = (link.project_id || link.contact_id) ? 'team' : (d.visibility ?? 'personal')

  const { id } = await repo.insertTask(db, {
    owner_id: link.owner_id,
    workspace_id: link.workspace_id,
    project_id: link.project_id,
    contact_id: link.contact_id,
    visibility,
    stage_id: stageId,
    created_by: ctx.userId,
    title: d.title,
    description: d.description ?? null,
    priority: d.priority ?? 'medium',
    start_date: d.start_date ?? null,
    due_date: d.due_date ?? null,
    estimated_minutes: d.estimated_minutes ?? null,
  })

  if (d.assignee_ids?.length) {
    await repo.setAssignees(db, id, d.assignee_ids)
    await notifyAssigned({ id, owner_id: link.owner_id, workspace_id: link.workspace_id, contact_id: link.contact_id }, d.assignee_ids, d.title, ctx.userId)
  }

  // Client-linked tasks are visible in the portal, so the client should hear
  // about them the same way they hear about a file or a contract.
  if (link.contact_id) {
    announceToClient({
      contactId: link.contact_id,
      ownerId:   link.owner_id,
      type:      'task',
      title:     'New task added',
      body:      d.title,
      link:      `/tasks?taskId=${id}`,
      entityType: 'task',
      entityId:   id,
    })
  }

  return getTask(db, id)
}

export async function updateTask(db: SupabaseClient, ctx: Ctx, id: string, input: unknown): Promise<Task> {
  const existing = await repo.getTaskCore(db, id)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid update.', 'TASK_INVALID')
  const d = parsed.data

  const updates: Record<string, unknown> = {}
  if (d.title !== undefined) updates.title = d.title
  if (d.description !== undefined) updates.description = d.description
  if (d.visibility !== undefined) updates.visibility = d.visibility
  if (d.stage_id !== undefined) updates.stage_id = d.stage_id
  if (d.priority !== undefined) updates.priority = d.priority
  if (d.start_date !== undefined) updates.start_date = d.start_date
  if (d.due_date !== undefined) updates.due_date = d.due_date
  if (d.estimated_minutes !== undefined) updates.estimated_minutes = d.estimated_minutes
  if (d.logged_minutes !== undefined) updates.logged_minutes = d.logged_minutes
  if (d.sort_order !== undefined) updates.sort_order = d.sort_order
  if (d.done !== undefined) {
    updates.done = d.done
    updates.completed_at = d.done ? new Date().toISOString() : null
  }

  // Re-linking a task re-derives owner/workspace/contact from the new target.
  if (d.project_id !== undefined || d.contact_id !== undefined) {
    const link = await resolveLink(db, ctx, d.project_id ?? existing.project_id, d.contact_id ?? existing.contact_id)
    updates.project_id = link.project_id
    updates.contact_id = link.contact_id
    updates.owner_id = link.owner_id
    updates.workspace_id = link.workspace_id
  }

  await repo.updateTaskRow(db, id, updates)
  if (d.description !== undefined) await cleanupRemovedDescriptionImages(id, existing.description, d.description)

  const core: TaskCore = {
    id,
    owner_id:     existing.owner_id,
    workspace_id: existing.workspace_id,
    contact_id:   (updates.contact_id as string | null | undefined) ?? existing.contact_id,
  }
  const taskTitle = d.title ?? existing.title

  // Every change on a task reaches everyone on it. The three are separated
  // because they read differently to the person receiving them: a stage move
  // says where the work is now, completion says it's finished, and an edit says
  // the brief moved under your feet. One event fires per save — a save that
  // both moves the stage and edits the title announces the move, since that's
  // the larger fact.
  const recipients = await participantsOf(id)
  const movedStage = d.stage_id !== undefined && d.stage_id && d.stage_id !== existing.stage_id
  const completed  = d.done === true && !existing.done
  const reopened   = d.done === false && existing.done
  const edits      = changedFields(existing as unknown as Record<string, unknown>, d as Record<string, unknown>)

  if (movedStage) {
    const stageName = await repo.getStageName(db, d.stage_id!)
    if (stageName) {
      await announceTaskEvent({ core, recipients, actorId: ctx.userId, headline: `Moved to ${stageName}`, detail: taskTitle })
    }
  } else if (completed) {
    await announceTaskEvent({ core, recipients, actorId: ctx.userId, headline: 'Task completed', detail: taskTitle })
  } else if (reopened) {
    await announceTaskEvent({ core, recipients, actorId: ctx.userId, headline: 'Task reopened', detail: taskTitle })
  } else if (edits.length > 0) {
    await announceTaskEvent({
      core, recipients, actorId: ctx.userId,
      headline: 'Task updated',
      detail: `${taskTitle} — ${describeChanges(edits)} changed`,
    })
  }

  return getTask(db, id)
}

/**
 * Images pasted into a description are stored as hosted URLs inside the text,
 * so editing one out is the only "delete" a user gets — this drops the matching
 * Cloudinary asset. Scoped to this task's own description folder, so a URL
 * pasted in from an attachment or another task is never destroyed. Best-effort:
 * the text is the source of truth, cleanup never fails the update.
 */
async function cleanupRemovedDescriptionImages(
  taskId: string,
  before: string | null,
  after: string | null,
): Promise<void> {
  if (!before) return
  const kept = new Set(extractImageUrls(after ?? ''))
  const removed = extractImageUrls(before).filter((url) => !kept.has(url))
  const prefix = `${UPLOAD_ROOT_FOLDER}/${taskDescriptionUploadFolder(taskId)}/`
  for (const url of removed) {
    const parsed = parseCloudinaryUrl(url)
    if (!parsed?.publicId.startsWith(prefix)) continue
    const cleaned = await destroyCloudinaryAssetById(parsed.publicId, parsed.resourceType)
    if (!cleaned) console.warn('[updateTask] description image cleanup failed (description saved)', { taskId })
  }
}

/**
 * Removes a task and tells everyone who was on it.
 *
 * Participants are collected BEFORE the delete: afterwards the assignee rows
 * are still there, but reading them post-hoc would be luck rather than intent.
 * `actorId` is optional so older callers keep working — without it the deleter
 * is notified too, which is worse than a missing name but not wrong.
 */
export async function deleteTask(db: SupabaseClient, id: string, actorId?: string): Promise<void> {
  const existing = await repo.getTaskCore(db, id)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  const recipients = await participantsOf(id)
  await repo.softDeleteTask(db, id)
  await announceTaskEvent({
    core: { id, owner_id: existing.owner_id, workspace_id: existing.workspace_id, contact_id: existing.contact_id },
    recipients,
    actorId: actorId ?? '',
    headline: 'Task deleted',
    detail: existing.title,
    gone: true,
  })
}

export async function setAssignees(db: SupabaseClient, taskId: string, userIds: string[], actorId: string): Promise<Task> {
  const existing = await repo.getTaskCore(db, taskId)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  const prev = await repo.getAssigneeIds(db, taskId)
  await repo.setAssignees(db, taskId, userIds)
  const added   = userIds.filter((id) => !prev.includes(id))
  const removed = prev.filter((id) => !userIds.includes(id))
  if (added.length) {
    const task = await repo.getTaskById(db, taskId)
    await notifyAssigned(existing, added, task?.title ?? 'A task', actorId)
  }
  // Everyone still on the task hears that the line-up changed — including the
  // people taken off it, who otherwise find out by the task quietly vanishing.
  if (added.length || removed.length) {
    await announceTaskEvent({
      core: existing,
      recipients: [...new Set([...prev, ...userIds])].filter((id) => !added.includes(id)),
      actorId,
      headline: 'Task assignees changed',
      detail: existing.title,
    })
  }
  return getTask(db, taskId)
}

// ── Files ─────────────────────────────────────────────────────────────────────

const fileSchema = z.object({
  file_name: z.string().trim().min(1, 'File name is required.').max(300),
  // Uploads go direct to Cloudinary; the metadata row must point back at it.
  file_url: z.string().url().startsWith('https://res.cloudinary.com/', 'Invalid file URL.'),
  public_id: z.string().min(1).max(300),
  file_size: z.number().int().min(0).max(MAX_UPLOAD_BYTES, 'File is too large.').nullable().optional(),
  file_type: z.string().max(100).nullable().optional(),
})

/** Records a Cloudinary upload against a task. The binary is already uploaded
 *  client-side (signed); this validates + stores the metadata row. */
export async function addTaskFile(
  db: SupabaseClient,
  taskId: string,
  input: unknown,
  actor: { userId: string; name: string | null },
): Promise<TaskFileRow> {
  const existing = await repo.getTaskCore(db, taskId)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')

  const parsed = fileSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid file.', 'TASK_FILE_INVALID')
  const d = parsed.data

  // Defense in depth: re-check the extension server-side (SECURITY.md) — the
  // client validates before uploading, but the metadata write must not trust it.
  const ext = d.file_name.split('.').pop()?.toLowerCase() ?? ''
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppError(422, 'That file type is not allowed.', 'TASK_FILE_INVALID_TYPE')
  }

  return repo.insertTaskFile(db, {
    task_id: taskId,
    owner_id: existing.owner_id,
    uploaded_by: actor.userId,
    uploader_name: actor.name,
    file_name: d.file_name,
    file_url: d.file_url,
    public_id: d.public_id,
    file_size: d.file_size ?? null,
    file_type: d.file_type ?? null,
  })
}

/** Deletes a file's metadata row, then best-effort removes the Cloudinary
 *  asset server-side. The resource type (image/video/raw) is parsed from the
 *  delivery URL; the exact stored public_id is used so raw files (which keep
 *  their extension in the public_id) delete correctly. */
export async function deleteTaskFile(db: SupabaseClient, taskId: string, fileId: string): Promise<void> {
  const file = await repo.getTaskFile(db, fileId)
  if (!file || file.task_id !== taskId) throw new AppError(404, 'That file could not be found.', 'TASK_FILE_NOT_FOUND')
  await repo.deleteTaskFileRow(db, fileId)

  const resourceType = parseCloudinaryUrl(file.file_url)?.resourceType ?? 'image'
  const cleaned = await destroyCloudinaryAssetById(file.public_id, resourceType)
  if (!cleaned) console.warn('[deleteTaskFile] Cloudinary cleanup failed (metadata removed)', { fileId })
}

// ── Subtasks ──────────────────────────────────────────────────────────────────

export async function addSubtask(db: SupabaseClient, taskId: string, title: string, sortOrder: number) {
  const existing = await repo.getTaskCore(db, taskId)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  const trimmed = title.trim()
  if (!trimmed) throw new AppError(400, 'Add a subtask title.', 'SUBTASK_INVALID')
  return repo.insertSubtask(db, { task_id: taskId, title: trimmed.slice(0, 500), sort_order: sortOrder })
}

export async function updateSubtask(db: SupabaseClient, id: string, updates: { title?: string; done?: boolean; sort_order?: number }) {
  const parent = await repo.getSubtaskParent(db, id)
  if (!parent) throw new AppError(404, 'That subtask could not be found.', 'SUBTASK_NOT_FOUND')
  if (updates.title !== undefined) {
    const trimmed = updates.title.trim()
    if (!trimmed) throw new AppError(400, 'Subtask title cannot be empty.', 'SUBTASK_INVALID')
    updates = { ...updates, title: trimmed.slice(0, 500) }
  }
  await repo.updateSubtaskRow(db, id, updates)
}

export async function deleteSubtask(db: SupabaseClient, id: string) {
  const parent = await repo.getSubtaskParent(db, id)
  if (!parent) throw new AppError(404, 'That subtask could not be found.', 'SUBTASK_NOT_FOUND')
  await repo.deleteSubtaskRow(db, id)
}
