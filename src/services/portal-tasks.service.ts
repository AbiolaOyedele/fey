import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { notify, notifyOwnerAdmins } from '@/services/notifications.service'
import { resolveOwnerWorkflow } from '@/services/workflows.service'
import * as access from '@/repositories/client-team-access.repository'
import * as portalRepo from '@/repositories/portal.repository'
import * as projectRepo from '@/repositories/portal-projects.repository'
import { isReadOnly } from '@/services/portal-members.service'
import * as taskRepo from '@/repositories/work-tasks.repository'
import * as commentRepo from '@/repositories/task-comments.repository'
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

/**
 * The board columns, so the portal can show and change status like the app.
 *
 * The agency's own stages, not a stock set — see `resolveOwnerWorkflow`. If
 * they renamed their columns to Briefed / Drafting / With client, that's what
 * the client picks from, and a task the client raises lands in a column the
 * agency actually uses.
 */
export async function listStages(db: SupabaseClient, scope: Scope) {
  const workspaceId = await portalRepo.getOwnerWorkspaceId(db, scope.ownerId)
  const workflow = await resolveOwnerWorkflow(db, scope.ownerId, workspaceId)
  return workflow.stages
}

/**
 * The brands this client can file a task against.
 *
 * Their own projects, and the same list the Brands section shows them — so the
 * picker can't offer something the create endpoint will then refuse.
 */
export async function listBrands(db: SupabaseClient, scope: Scope): Promise<{ id: string; title: string }[]> {
  const projects = await projectRepo.listProjectsForContact(db, scope.contactId, scope.ownerId)
  return projects.map((p) => ({ id: p.id, title: p.title }))
}

/** The agency's board, resolved the same way for reads and writes. */
async function ownerWorkflow(db: SupabaseClient, scope: Scope) {
  const workspaceId = await portalRepo.getOwnerWorkspaceId(db, scope.ownerId)
  return resolveOwnerWorkflow(db, scope.ownerId, workspaceId)
}

/**
 * A stage id only if it names a column on the agency's own board.
 *
 * Stage ids arrive from a browser, and this runs service-role with no RLS
 * underneath it. Writing an unchecked one would let a client file their task
 * into a stage belonging to an entirely different agency — visible on nobody's
 * board and counted in somebody else's. Null means "not one of ours".
 */
function ownStageId(
  workflow: { stages: { id: string }[] },
  stageId: string | null | undefined,
): string | null {
  if (!stageId) return null
  return workflow.stages.some((s) => s.id === stageId) ? stageId : null
}

/**
 * Confirms a task is one this client is entitled to see at all.
 *
 * Weaker than `assertOwnTask` on purpose. That one gates editing, and only the
 * client who raised a task may edit it. Commenting is different: a client should
 * be able to say something about any work being done for them, including work
 * the agency raised — that is most of what they'd want to comment on.
 */
async function assertVisibleTask(db: SupabaseClient, scope: Scope, taskId: string): Promise<void> {
  const { data } = await db
    .from('work_tasks')
    .select('id')
    .eq('id', taskId)
    .eq('contact_id', scope.contactId)
    .eq('owner_id', scope.ownerId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) {
    throw new AppError(404, 'That task isn’t one of yours.', 'PORTAL_TASK_NOT_VISIBLE')
  }
}

/** The whole thread on a task — the agency's comments and the client's alike. */
export async function listComments(db: SupabaseClient, scope: Scope, taskId: string) {
  await assertVisibleTask(db, scope, taskId)
  return commentRepo.listCommentsForPortal(db, taskId)
}

const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first.').max(10000),
})

/**
 * A client's comment on a task.
 *
 * Attributed to the portal user from the verified token, never from the body,
 * and written into the same thread the team reads — so a client's question
 * appears where the work is discussed rather than in a separate inbox nobody
 * checks. The team is notified; a comment nobody sees is the same as no comment.
 */
export async function addComment(
  db: SupabaseClient,
  scope: Scope,
  actor: Pick<PortalUser, 'id' | 'name' | 'role'>,
  taskId: string,
  input: unknown,
) {
  if (isReadOnly(actor.role)) {
    throw new AppError(403, 'Your access is view-only, so you can’t comment.', 'PORTAL_COMMENT_FORBIDDEN')
  }
  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That comment isn’t valid.', 'PORTAL_COMMENT_INVALID')
  }
  await assertVisibleTask(db, scope, taskId)

  const comment = await commentRepo.insertComment(db, {
    task_id: taskId,
    portal_author_id: actor.id,
    body: parsed.data.body,
  })

  const task = await taskRepo.getTaskById(db, taskId)
  const workspaceId = await portalRepo.getOwnerWorkspaceId(db, scope.ownerId)
  // Whoever is holding it hears first; if nobody is, the owner and admins do,
  // because an unanswered client question is worse than a noisy notification.
  const holder = task?.responsible_id
  if (holder) {
    await notify({
      db,
      recipientIds: [holder],
      workspaceId,
      type:  'task_comment',
      title: `${actor.name} commented`,
      body:  `${task?.title ?? 'A task'} — ${parsed.data.body.slice(0, 120)}`,
      link:  `/tasks?taskId=${taskId}`,
      entityType: 'task',
      entityId:   taskId,
    })
  } else {
    await notifyOwnerAdmins(db, scope.ownerId, {
      type:  'task_comment',
      title: `${actor.name} commented`,
      body:  `${task?.title ?? 'A task'} — ${parsed.data.body.slice(0, 120)}`,
      link:  `/tasks?taskId=${taskId}`,
      entityType: 'task',
      entityId:   taskId,
    })
  }

  return { ...comment, portal_author_name: actor.name }
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
  // Accepted, then checked against the agency's own board below. A client
  // picking a column is fine; a client naming someone else's column is not.
  stage_id:    z.string().uuid().nullish(),
  // Which brand the work is for. Checked against the brands this contact can
  // actually see before it's written — see the note in createTask.
  project_id:  z.string().uuid().nullish(),
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

  // The brand, only if it's one of theirs.
  //
  // Same reasoning as the stage check, and it matters more: this runs
  // service-role with no RLS underneath, so an unchecked project_id would let a
  // client file a task against another agency's brand — and that task would then
  // show up on that brand's board and in its reporting. An id that isn't theirs
  // is refused outright rather than quietly dropped, because silently filing the
  // work somewhere else is how a request goes missing.
  let projectId: string | null = null
  if (d.project_id) {
    const project = await projectRepo.getProjectForPortal(db, d.project_id, scope.contactId, scope.ownerId)
    if (!project) {
      throw new AppError(404, 'That brand isn’t one of yours, so the task can’t be filed under it.', 'PORTAL_TASK_BRAND_NOT_YOURS')
    }
    projectId = project.id
  }

  const workflow = await ownerWorkflow(db, scope)
  // The client's choice, but only if it names a column on the agency's own
  // board. Falling back to the first column means the task still lands
  // somewhere people look rather than in an unstaged limbo.
  const stageId = ownStageId(workflow, d.stage_id) ?? workflow.stages[0]?.id ?? null
  const workspaceId = await portalRepo.getOwnerWorkspaceId(db, scope.ownerId)

  const taskId = await portalRepo.insertPortalTask(db, {
    ownerId:      scope.ownerId,
    workspaceId,
    contactId:    scope.contactId,
    portalUserId: actor.id,
    stageId,
    projectId,
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
    // Nobody was picked, so it would otherwise land silently. Client tasks are
    // always team-visible, and team-visible with nobody on it is precisely the
    // state that needs saying out loud — the same rule the app applies to its
    // own unassigned team tasks.
    await notifyOwnerAdmins(db, scope.ownerId, {
      type:  'task_unassigned',
      title: `${actor.name} raised a task — nobody assigned`,
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
  db: SupabaseClient, scope: Scope, actor: Pick<PortalUser, 'id' | 'name' | 'role'>, taskId: string, input: unknown,
): Promise<Task> {
  const actorName = actor.name
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
  if (d.stage_id !== undefined) {
    // Same check as on create: a client may move their task between the
    // agency's columns, and nowhere else. An id that isn't on this board is
    // rejected rather than quietly written.
    const stageId = ownStageId(await ownerWorkflow(db, scope), d.stage_id)
    if (d.stage_id !== null && !stageId) {
      throw new AppError(400, 'That status isn’t one of your team’s.', 'PORTAL_TASK_STAGE_INVALID')
    }
    updates.stage_id = stageId
  }
  if (d.done !== undefined) {
    updates.done = d.done
    updates.completed_at = d.done ? new Date().toISOString() : null
  }
  if (Object.keys(updates).length > 0) await taskRepo.updateTaskRow(db, taskId, updates)

  const all = await listTasks(db, scope)
  const updated = all.find((t) => t.id === taskId)
  if (!updated) throw new AppError(500, 'The task was updated but couldn’t be loaded.', 'PORTAL_TASK_RELOAD_FAILED')

  // The agency hears about the client's edit the same way the client hears
  // about theirs — otherwise a brief can change under the team without a word.
  await announceClientEdit(db, scope, actorName, updated, d)

  return updated
}

/** Field names as they read to the team, for the "what changed" line. */
const CLIENT_FIELD_LABELS: Record<string, string> = {
  title:       'title',
  description: 'description',
  priority:    'priority',
  due_date:    'due date',
  stage_id:    'status',
}

async function announceClientEdit(
  db: SupabaseClient,
  scope: Scope,
  actorName: string,
  task: Task,
  patch: Record<string, unknown>,
): Promise<void> {
  const completed = patch.done === true
  const reopened  = patch.done === false
  const changed = Object.keys(CLIENT_FIELD_LABELS).filter((k) => patch[k] !== undefined)
  if (!completed && !reopened && changed.length === 0 && patch.assignee_ids === undefined) return

  const headline = completed ? `${actorName} completed a task`
    : reopened ? `${actorName} reopened a task`
    : `${actorName} updated a task`
  const detail = completed || reopened || changed.length === 0
    ? task.title
    : `${task.title} — ${changed.map((k) => CLIENT_FIELD_LABELS[k]).join(', ')} changed`

  const workspaceId = await portalRepo.getOwnerWorkspaceId(db, scope.ownerId)
  const recipients = await taskRepo.getTaskParticipants(db, task.id)
  const args = {
    type:  'task_updated',
    title: headline,
    body:  detail,
    link:  `/tasks?taskId=${task.id}`,
    entityType: 'task',
    entityId:   task.id,
  } as const

  if (recipients.length > 0) await notify({ db, recipientIds: recipients, workspaceId, ...args })
  else await notifyOwnerAdmins(db, scope.ownerId, args)
}

/**
 * Removes a task the client raised.
 *
 * A client can create work, so a client can withdraw it — the alternative was a
 * task board that only ever grows and a message asking the agency to tidy up.
 * The scope is deliberately narrow: `assertOwnTask` means only tasks raised from
 * this portal, by this client, can go. Agency-created work is not theirs to
 * delete, and the 404 says so plainly.
 *
 * Soft delete, like the app's own — it lands in the recycle bin, not the void.
 * Everyone who was on the task is told, so nobody discovers it by its absence.
 */
export async function deleteTask(
  db: SupabaseClient,
  scope: Scope,
  actor: Pick<PortalUser, 'name' | 'role'>,
  taskId: string,
): Promise<void> {
  if (isReadOnly(actor.role)) {
    throw new AppError(403, 'Your access is view-only, so you can’t remove tasks.', 'PORTAL_TASK_FORBIDDEN')
  }
  await assertOwnTask(db, scope, taskId)

  const task = await taskRepo.getTaskById(db, taskId)
  const recipients = await taskRepo.getTaskParticipants(db, taskId)
  await taskRepo.softDeleteTask(db, taskId)

  const workspaceId = await portalRepo.getOwnerWorkspaceId(db, scope.ownerId)
  if (recipients.length > 0) {
    await notify({
      db,
      recipientIds: recipients,
      workspaceId,
      type:  'task_deleted',
      title: `${actor.name} removed a task`,
      body:  task?.title ?? null,
      link:  '/tasks',
      entityType: 'task',
      entityId:   taskId,
    })
  } else {
    // Nobody was assigned, so the people who can act on it are the ones who saw
    // it arrive on the board.
    await notifyOwnerAdmins(db, scope.ownerId, {
      type:  'task_deleted',
      title: `${actor.name} removed a task`,
      body:  task?.title ?? null,
      link:  '/tasks',
      entityType: 'task',
      entityId:   taskId,
    })
  }
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
