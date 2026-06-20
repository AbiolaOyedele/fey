import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { createServiceClient } from '@/lib/supabase-server'
import type { Task, TaskScope } from '@/types/work-tasks'
import * as repo from '@/repositories/work-tasks.repository'
import * as wfRepo from '@/repositories/workflows.repository'
import { ensureDefaultWorkflow } from '@/services/workflows.service'
import { notify } from '@/services/notifications.service'

/** Notify newly-added assignees (best-effort; never blocks the task write). */
async function notifyAssigned(
  core: { id: string; owner_id: string; workspace_id: string | null; contact_id: string | null },
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
      link: core.contact_id ? `/clients/${core.contact_id}/tasks` : '/tasks',
      entityType: 'task',
      entityId: core.id,
    })
  } catch { /* best-effort */ }
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
  opts: { scope: TaskScope; projectId?: string | null; contactId?: string | null; done?: boolean },
): Promise<Task[]> {
  return repo.listTasks(db, { ownerId, scope: opts.scope, projectId: opts.projectId ?? null, contactId: opts.contactId ?? null, ...(opts.done !== undefined ? { done: opts.done } : {}) })
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

  const { id } = await repo.insertTask(db, {
    owner_id: link.owner_id,
    workspace_id: link.workspace_id,
    project_id: link.project_id,
    contact_id: link.contact_id,
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
  return getTask(db, id)
}

export async function deleteTask(db: SupabaseClient, id: string): Promise<void> {
  const existing = await repo.getTaskCore(db, id)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  await repo.softDeleteTask(db, id)
}

export async function setAssignees(db: SupabaseClient, taskId: string, userIds: string[], actorId: string): Promise<Task> {
  const existing = await repo.getTaskCore(db, taskId)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  const prev = await repo.getAssigneeIds(db, taskId)
  await repo.setAssignees(db, taskId, userIds)
  const added = userIds.filter((id) => !prev.includes(id))
  if (added.length) {
    const task = await repo.getTaskById(db, taskId)
    await notifyAssigned(existing, added, task?.title ?? 'A task', actorId)
  }
  return getTask(db, taskId)
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
  await repo.updateSubtaskRow(db, id, updates)
}

export async function deleteSubtask(db: SupabaseClient, id: string) {
  const parent = await repo.getSubtaskParent(db, id)
  if (!parent) throw new AppError(404, 'That subtask could not be found.', 'SUBTASK_NOT_FOUND')
  await repo.deleteSubtaskRow(db, id)
}
