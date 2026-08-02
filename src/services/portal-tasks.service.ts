import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { notify, notifyOwnerAdmins } from '@/services/notifications.service'
import { ensureDefaultWorkflow } from '@/services/workflows.service'
import * as access from '@/repositories/client-team-access.repository'
import * as portalRepo from '@/repositories/portal.repository'
import { isReadOnly } from '@/services/portal-members.service'
import * as taskRepo from '@/repositories/work-tasks.repository'
import type { Task } from '@/types/work-tasks'
import type { ClientTeamMember, PortalUser } from '@/types/crm'

/**
 * Tasks as the client sees them, and tasks the client raises.
 *
 * Everything here runs on a service-role client because portal users aren't
 * auth users and RLS can't authorise them. That makes the scoping in this file
 * the only thing standing between one client and another's data, so every read
 * and write is keyed on a contact_id lifted from the verified portal token —
 * never from the request body.
 */

interface Scope {
  contactId: string
  ownerId: string
}

/**
 * The client's tasks, in the SAME shape the app uses.
 *
 * Reads through the app's own task repository rather than a portal-specific
 * query, so the portal gets descriptions, subtasks, files and assignees for
 * free — and the two sides can't drift apart as the task model grows.
 */
export async function listTasks(db: SupabaseClient, scope: Scope): Promise<Task[]> {
  const [tasks, visible] = await Promise.all([
    taskRepo.listTasks(db, { ownerId: scope.ownerId, scope: 'contact', contactId: scope.contactId }),
    access.visibleMemberMap(db, scope.contactId, scope.ownerId),
  ])
  return tasks.map((t) => ({
    ...t,
    // Someone outside the client's granted list is omitted rather than shown
    // anonymously — the client isn't entitled to know the rest of the roster.
    assignees: t.assignees
      .filter((a) => visible.has(a.user_id))
      .map((a) => ({ user_id: a.user_id, name: visible.get(a.user_id) ?? a.name, email: null })),
  }))
}

/** The board columns, so the portal can show and change status like the app. */
export async function listStages(db: SupabaseClient, scope: Scope) {
  const workspaceId = await portalRepo.getOwnerWorkspaceId(db, scope.ownerId)
  const workflow = await ensureDefaultWorkflow(db, scope.ownerId, workspaceId)
  return workflow.stages
}

/** Only tasks the client raised are theirs to edit. Every write goes through this. */
async function assertOwnTask(db: SupabaseClient, scope: Scope, taskId: string): Promise<void> {
  const { data } = await db
    .from('work_tasks')
    .select('id')
    .eq('id', taskId)
    .eq('contact_id', scope.contactId)
    .not('requested_by_portal_user', 'is', null)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) {
    throw new AppError(404, 'That task isn’t one you raised, so it can’t be changed here.', 'PORTAL_TASK_NOT_YOURS')
  }
}

/** Who this client may assign work to. Empty until the owner grants access. */
export async function listAssignableMembers(
  db: SupabaseClient,
  scope: Scope,
): Promise<ClientTeamMember[]> {
  return access.listVisibleMembers(db, scope.contactId, scope.ownerId)
}

const createSchema = z.object({
  title:       z.string().min(1, 'Give the task a title.').max(500).trim(),
  description: z.string().max(5000).trim().nullish(),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.').nullish(),
  priority:    z.enum(['low', 'medium', 'high']).optional(),
  assignee_ids: z.array(z.string().uuid()).max(10).optional(),
})

/**
 * Raises a task on behalf of a client.
 *
 * Two guards that matter:
 *   • viewers can't create anything — the role exists precisely to be read-only
 *   • assignees must be within the client's granted access list, so a client
 *     can't assign work to someone the owner never exposed to them, even by
 *     guessing a user id
 */
export async function createTask(
  db: SupabaseClient,
  scope: Scope,
  actor: Pick<PortalUser, 'id' | 'name' | 'role'>,
  input: unknown,
): Promise<Task> {
  if (isReadOnly(actor.role)) {
    throw new AppError(403, 'Your access is view-only, so you can’t add tasks.', 'PORTAL_TASK_FORBIDDEN')
  }

  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That task isn’t valid.', 'PORTAL_TASK_INVALID')
  }
  const d = parsed.data

  const requested = d.assignee_ids ?? []
  if (requested.length > 0) {
    const allowed = new Set(await access.listAccessUserIds(db, scope.contactId))
    if (requested.some((id) => !allowed.has(id))) {
      throw new AppError(
        403,
        'One of the people you picked isn’t available on your account.',
        'PORTAL_TASK_ASSIGNEE_FORBIDDEN',
      )
    }
  }

  const workspaceId = await portalRepo.getOwnerWorkspaceId(db, scope.ownerId)
  // Land it in the first board column so it shows up on the agency's board
  // rather than sitting in an unstaged limbo nobody looks at.
  const workflow = await ensureDefaultWorkflow(db, scope.ownerId, workspaceId)
  const stageId = workflow.stages[0]?.id ?? null

  const taskId = await portalRepo.insertPortalTask(db, {
    ownerId:      scope.ownerId,
    workspaceId,
    contactId:    scope.contactId,
    portalUserId: actor.id,
    stageId,
    title:        d.title,
    description:  d.description ?? null,
    priority:     d.priority ?? 'medium',
    dueDate:      d.due_date ?? null,
  })

  if (requested.length > 0) {
    await portalRepo.assignPortalTask(db, taskId, requested)
    await notify({
      db,
      recipientIds: requested,
      workspaceId,
      type:  'task_assigned',
      title: `${actor.name} assigned you a task`,
      body:  d.title,
      link:  `/tasks?taskId=${taskId}`,
      entityType: 'task',
      entityId:   taskId,
    })
  } else {
    // Nobody was picked, so it would otherwise land silently. Tell the people
    // who can act on it that a client is waiting.
    await notifyOwnerAdmins(db, scope.ownerId, {
      type:  'task_assigned',
      title: `${actor.name} raised a task`,
      body:  d.title,
      link:  `/tasks?taskId=${taskId}`,
      entityType: 'task',
      entityId:   taskId,
    })
  }

  const all = await listTasks(db, scope)
  const created = all.find((t) => t.id === taskId)
  if (!created) {
    throw new AppError(500, 'The task was created but couldn’t be loaded.', 'PORTAL_TASK_RELOAD_FAILED')
  }
  return created
}

const patchSchema = z.object({
  title:       z.string().min(1).max(500).trim().optional(),
  description: z.string().max(20_000).nullish(),
  priority:    z.enum(['low', 'medium', 'high']).optional(),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  stage_id:    z.string().uuid().nullish(),
  done:        z.boolean().optional(),
  assignee_ids: z.array(z.string().uuid()).max(10).optional(),
})

/** Edits a task the client raised. Scope is enforced by `assertOwnTask`. */
export async function patchTask(
  db: SupabaseClient, scope: Scope, actor: Pick<PortalUser, 'id' | 'role'>, taskId: string, input: unknown,
): Promise<Task> {
  if (isReadOnly(actor.role)) {
    throw new AppError(403, 'Your access is view-only, so you can’t change tasks.', 'PORTAL_TASK_FORBIDDEN')
  }
  await assertOwnTask(db, scope, taskId)

  const parsed = patchSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That change isn’t valid.', 'PORTAL_TASK_INVALID')
  }
  const d = parsed.data

  if (d.assignee_ids) {
    const allowed = new Set(await access.listAccessUserIds(db, scope.contactId))
    if (d.assignee_ids.some((id) => !allowed.has(id))) {
      throw new AppError(403, 'One of the people you picked isn’t available on your account.', 'PORTAL_TASK_ASSIGNEE_FORBIDDEN')
    }
    await taskRepo.setAssignees(db, taskId, d.assignee_ids)
  }

  const updates: Record<string, unknown> = {}
  if (d.title !== undefined)       updates.title = d.title
  if (d.description !== undefined) updates.description = d.description
  if (d.priority !== undefined)    updates.priority = d.priority
  if (d.due_date !== undefined)    updates.due_date = d.due_date
  if (d.stage_id !== undefined)    updates.stage_id = d.stage_id
  if (d.done !== undefined) {
    updates.done = d.done
    updates.completed_at = d.done ? new Date().toISOString() : null
  }
  if (Object.keys(updates).length > 0) await taskRepo.updateTaskRow(db, taskId, updates)

  const all = await listTasks(db, scope)
  const updated = all.find((t) => t.id === taskId)
  if (!updated) throw new AppError(500, 'The task was updated but couldn’t be loaded.', 'PORTAL_TASK_RELOAD_FAILED')
  return updated
}

// ── Subtasks ────────────────────────────────────────────────────────────────

export async function addSubtask(
  db: SupabaseClient, scope: Scope, actor: Pick<PortalUser, 'role'>, taskId: string, title: string,
): Promise<void> {
  if (isReadOnly(actor.role)) throw new AppError(403, 'Your access is view-only.', 'PORTAL_TASK_FORBIDDEN')
  await assertOwnTask(db, scope, taskId)
  const clean = title.trim()
  if (!clean) throw new AppError(400, 'Give the step a name.', 'PORTAL_TASK_INVALID')
  const existing = await listTasks(db, scope)
  const sortOrder = existing.find((t) => t.id === taskId)?.subtasks.length ?? 0
  await taskRepo.insertSubtask(db, { task_id: taskId, title: clean.slice(0, 500), sort_order: sortOrder })
}

export async function updateSubtask(
  db: SupabaseClient, scope: Scope, actor: Pick<PortalUser, 'role'>,
  taskId: string, subtaskId: string, patch: { title?: string | undefined; done?: boolean | undefined },
): Promise<void> {
  if (isReadOnly(actor.role)) throw new AppError(403, 'Your access is view-only.', 'PORTAL_TASK_FORBIDDEN')
  await assertOwnTask(db, scope, taskId)
  // Spread only the keys actually present — exactOptionalPropertyTypes won't
  // accept an explicit `undefined` where the repo expects the key absent.
  await taskRepo.updateSubtaskRow(db, subtaskId, {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.done  !== undefined ? { done: patch.done }   : {}),
  })
}

export async function deleteSubtask(
  db: SupabaseClient, scope: Scope, actor: Pick<PortalUser, 'role'>, taskId: string, subtaskId: string,
): Promise<void> {
  if (isReadOnly(actor.role)) throw new AppError(403, 'Your access is view-only.', 'PORTAL_TASK_FORBIDDEN')
  await assertOwnTask(db, scope, taskId)
  await taskRepo.deleteSubtaskRow(db, subtaskId)
}

// ── Attachments ─────────────────────────────────────────────────────────────

export async function addFile(
  db: SupabaseClient, scope: Scope, actor: Pick<PortalUser, 'role' | 'name'>, taskId: string,
  file: { file_name: string; file_url: string; public_id: string; file_size: number | null; file_type: string | null },
): Promise<void> {
  if (isReadOnly(actor.role)) throw new AppError(403, 'Your access is view-only.', 'PORTAL_TASK_FORBIDDEN')
  await assertOwnTask(db, scope, taskId)
  // uploaded_by is the workspace owner: the column is an FK to auth.users and a
  // portal user isn't one. uploader_name carries who really attached it.
  await taskRepo.insertTaskFile(db, {
    task_id: taskId, owner_id: scope.ownerId, uploaded_by: scope.ownerId,
    uploader_name: actor.name, ...file,
  })
}

export async function removeFile(
  db: SupabaseClient, scope: Scope, actor: Pick<PortalUser, 'role'>, taskId: string, fileId: string,
): Promise<void> {
  if (isReadOnly(actor.role)) throw new AppError(403, 'Your access is view-only.', 'PORTAL_TASK_FORBIDDEN')
  await assertOwnTask(db, scope, taskId)
  await taskRepo.deleteTaskFileRow(db, fileId)
}
