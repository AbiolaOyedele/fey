import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { notify, notifyOwnerAdmins } from '@/services/notifications.service'
import { ensureDefaultWorkflow } from '@/services/workflows.service'
import * as access from '@/repositories/client-team-access.repository'
import * as portalRepo from '@/repositories/portal.repository'
import { isReadOnly } from '@/services/portal-members.service'
import type { ClientTeamMember, PortalTask, PortalUser } from '@/types/crm'

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

/** The client's tasks, with assignees narrowed to people they may see. */
export async function listTasks(db: SupabaseClient, scope: Scope): Promise<PortalTask[]> {
  const visible = await access.visibleMemberMap(db, scope.contactId, scope.ownerId)
  return portalRepo.listPortalTasks(db, scope.contactId, visible)
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
): Promise<PortalTask> {
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

const toggleSchema = z.object({ done: z.boolean() })

/**
 * Lets a client tick off a task — but only one they raised themselves.
 *
 * Deliberately narrow. A client marking their own request as "actually, we've
 * handled it" is useful; a client closing work the agency is tracking is not
 * theirs to decide, and would quietly rewrite the agency's own board. The
 * `requested_by_portal_user` filter is what draws that line, and it's applied
 * in the query rather than in a branch so there's no path around it.
 */
export async function setTaskDone(
  db: SupabaseClient,
  scope: Scope,
  actor: Pick<PortalUser, 'id' | 'role'>,
  taskId: string,
  input: unknown,
): Promise<PortalTask> {
  if (isReadOnly(actor.role)) {
    throw new AppError(403, 'Your access is view-only, so you can’t change tasks.', 'PORTAL_TASK_FORBIDDEN')
  }

  const parsed = toggleSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, 'That change isn’t valid.', 'PORTAL_TASK_INVALID')
  }
  const { done } = parsed.data

  const { data, error } = await db
    .from('work_tasks')
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', taskId)
    .eq('contact_id', scope.contactId)
    .not('requested_by_portal_user', 'is', null)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new AppError(
      404,
      'That task isn’t one you raised, so it can’t be changed here.',
      'PORTAL_TASK_NOT_YOURS',
    )
  }

  const all = await listTasks(db, scope)
  const updated = all.find((t) => t.id === taskId)
  if (!updated) {
    throw new AppError(500, 'The task was updated but couldn’t be loaded.', 'PORTAL_TASK_RELOAD_FAILED')
  }
  return updated
}
