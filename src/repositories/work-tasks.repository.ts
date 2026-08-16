import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Task, Subtask, TaskAssignee, TaskFileRow, TaskScope, TaskHandoff, HandoffKind, TaskApprovalState,
} from '@/types/work-tasks'

/**
 * All task queries (work_tasks + assignees + subtasks). Callers pass a
 * user-scoped client (RLS enforced) for owner actions, or a service-role client
 * for the portal (after the route verifies the portal JWT).
 */

const SELECT = `
  id, owner_id, workspace_id, project_id, contact_id, stage_id, created_by, visibility,
  requested_by_portal_user, responsible_id, stage_entered_at, approval_state,
  title, description, priority, start_date, due_date, estimated_minutes,
  logged_minutes, sort_order, done, completed_at, created_at, updated_at,
  work_task_assignees ( user_id ),
  work_subtasks ( id, task_id, title, done, sort_order ),
  work_task_files ( id, file_name, file_url, public_id, file_size, file_type, uploader_name, created_at ),
  projects:project_id ( title ),
  crm_contacts:contact_id ( name ),
  social_posts ( id, scheduled_date, deleted_at )
`

interface RawTask {
  id: string
  owner_id: string
  workspace_id: string | null
  project_id: string | null
  contact_id: string | null
  stage_id: string | null
  created_by: string
  requested_by_portal_user: string | null
  visibility: Task['visibility']
  responsible_id: string | null
  stage_entered_at: string | null
  approval_state: TaskApprovalState | null
  title: string
  description: string | null
  priority: Task['priority']
  start_date: string | null
  due_date: string | null
  estimated_minutes: number | null
  logged_minutes: number
  sort_order: number
  done: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
  work_task_assignees: Array<{ user_id: string }> | null
  work_subtasks: Subtask[] | null
  work_task_files: TaskFileRow[] | null
  projects: { title: string } | { title: string }[] | null
  crm_contacts: { name: string } | { name: string }[] | null
  social_posts: Array<{ id: string; scheduled_date: string; deleted_at: string | null }> | null
}

type MemberInfo = { name: string | null; email: string | null }

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** Resolves a user id to a displayable person, for the baton holder. */
function person(userId: string | null, members: Map<string, MemberInfo>): TaskAssignee | null {
  if (!userId) return null
  const m = members.get(userId)
  return { user_id: userId, name: m?.name ?? null, email: m?.email ?? null }
}

function mapTask(row: RawTask, members: Map<string, MemberInfo>): Task {
  const assignees: TaskAssignee[] = (row.work_task_assignees ?? []).map((a) => ({
    user_id: a.user_id,
    name: members.get(a.user_id)?.name ?? null,
    email: members.get(a.user_id)?.email ?? null,
  }))
  return {
    id: row.id,
    owner_id: row.owner_id,
    workspace_id: row.workspace_id,
    project_id: row.project_id,
    contact_id: row.contact_id,
    stage_id: row.stage_id,
    created_by: row.created_by,
    requested_by_portal_user: row.requested_by_portal_user ?? null,
    visibility: row.visibility ?? 'personal',
    responsible_id: row.responsible_id ?? null,
    // Rows written before the stage clock existed fall back to creation, which
    // reads as "has been here a long time" — true, and better than "just now".
    stage_entered_at: row.stage_entered_at ?? row.created_at,
    approval_state: row.approval_state ?? 'none',
    title: row.title,
    description: row.description,
    priority: row.priority,
    start_date: row.start_date,
    due_date: row.due_date,
    estimated_minutes: row.estimated_minutes,
    logged_minutes: row.logged_minutes,
    sort_order: row.sort_order,
    done: row.done,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignees,
    responsible: person(row.responsible_id ?? null, members),
    subtasks: (row.work_subtasks ?? []).sort((a, b) => a.sort_order - b.sort_order),
    files: (row.work_task_files ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    project_title: one(row.projects)?.title ?? null,
    contact_name: one(row.crm_contacts)?.name ?? null,
    social_post: (() => {
      const p = (row.social_posts ?? []).find((sp) => !sp.deleted_at)
      return p ? { id: p.id, scheduled_date: p.scheduled_date } : null
    })(),
  }
}

/** Resolves user_id → display name/email for every member of the owner's workspaces. */
export async function getMembersMap(db: SupabaseClient, ownerId: string): Promise<Map<string, MemberInfo>> {
  const { data, error } = await db
    .from('workspace_members')
    .select('user_id, name, email, workspaces!inner ( owner_id )')
    .eq('workspaces.owner_id', ownerId)
  if (error) throw error
  const map = new Map<string, MemberInfo>()
  for (const r of (data ?? []) as Array<{ user_id: string; name: string | null; email: string | null }>) {
    if (!map.has(r.user_id)) map.set(r.user_id, { name: r.name, email: r.email })
  }
  return map
}

interface ListArgs {
  ownerId: string
  scope: TaskScope
  projectId?: string | null
  contactId?: string | null
  /** undefined = all, false = active only, true = completed only */
  done?: boolean
  /**
   * The caller, for role-scoped visibility on the workspace-wide `all` scope.
   * Admins see every task; members see only tasks that are theirs (created or
   * assigned) or team-visible. Omit to skip narrowing (e.g. portal/service reads).
   */
  viewer?: { id: string; isAdmin: boolean }
}

export async function listTasks(db: SupabaseClient, args: ListArgs): Promise<Task[]> {
  let q = db.from('work_tasks').select(SELECT).eq('owner_id', args.ownerId).is('deleted_at', null)

  if (args.scope === 'personal') q = q.is('project_id', null).is('contact_id', null).eq('visibility', 'personal')
  if (args.scope === 'team') q = q.is('project_id', null).is('contact_id', null).eq('visibility', 'team')
  if (args.scope === 'project' && args.projectId) q = q.eq('project_id', args.projectId)
  if (args.scope === 'contact' && args.contactId) q = q.eq('contact_id', args.contactId)
  if (typeof args.done === 'boolean') q = q.eq('done', args.done)

  q = q.order('sort_order', { ascending: true }).order('created_at', { ascending: false })

  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as RawTask[]
  const members = await getMembersMap(db, args.ownerId)
  let tasks = rows.map((r) => mapTask(r, members))

  // Member scoping for the workspace-wide "all" view (dashboard + Tasks section):
  // hide client/project tasks a member isn't on. RLS already limits members to
  // their own personal tasks + all team-visible ones, so only linked tasks need
  // narrowing here. Admins and the narrower scopes (personal/team/project/contact)
  // are returned as-is. This only removes rows — it never widens visibility.
  if (args.scope === 'all' && args.viewer && !args.viewer.isAdmin) {
    const uid = args.viewer.id
    tasks = tasks.filter((t) => {
      const linked = t.project_id !== null || t.contact_id !== null
      if (!linked) return true
      // Holding the baton counts as being on the task even without an assignee
      // row — a stage that hands work to its standing owner does exactly that.
      return t.created_by === uid || t.responsible_id === uid || t.assignees.some((a) => a.user_id === uid)
    })
  }

  return tasks
}

export async function getTaskById(db: SupabaseClient, id: string): Promise<Task | null> {
  const { data, error } = await db.from('work_tasks').select(SELECT).eq('id', id).is('deleted_at', null).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as RawTask
  const members = await getMembersMap(db, row.owner_id)
  return mapTask(row, members)
}

/**
 * Lightweight fetch (no joins) — used for ownership re-checks in the service,
 * and as the "before" side of an update so a change notification can name what
 * actually changed rather than firing on every re-save.
 */
export interface TaskCore {
  id: string; owner_id: string; workspace_id: string | null; project_id: string | null
  contact_id: string | null; created_by: string; done: boolean; description: string | null
  stage_id: string | null; title: string; priority: string
  start_date: string | null; due_date: string | null; estimated_minutes: number | null
  responsible_id: string | null; stage_entered_at: string | null; approval_state: TaskApprovalState
}

export async function getTaskCore(db: SupabaseClient, id: string): Promise<TaskCore | null> {
  const { data, error } = await db
    .from('work_tasks')
    .select('id, owner_id, workspace_id, project_id, contact_id, created_by, done, description, stage_id, title, priority, start_date, due_date, estimated_minutes, responsible_id, stage_entered_at, approval_state')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return (data as never) ?? null
}

export async function getStageName(db: SupabaseClient, stageId: string): Promise<string | null> {
  const { data } = await db.from('workflow_stages').select('name').eq('id', stageId).maybeSingle()
  return (data as { name?: string } | null)?.name ?? null
}

// ── Stage rules + handoff log ─────────────────────────────────────────────────

/** A stage's workflow position and its handoff/approval rules. */
export interface StageRules {
  id: string
  workflow_id: string
  name: string
  sort_order: number
  handoff_mode: 'keep' | 'fixed' | 'prompt'
  handoff_user_id: string | null
  requires_approval: boolean
  approver_id: string | null
  target_days: number | null
}

const STAGE_RULES_SELECT = 'id, workflow_id, name, sort_order, handoff_mode, handoff_user_id, requires_approval, approver_id, target_days'

export async function getStageRules(db: SupabaseClient, stageId: string): Promise<StageRules | null> {
  const { data, error } = await db.from('workflow_stages').select(STAGE_RULES_SELECT).eq('id', stageId).maybeSingle()
  if (error) throw error
  return (data as StageRules | null) ?? null
}

/**
 * The stage immediately after (`+1`) or before (`-1`) this one in its workflow.
 * Used to advance a task on approval and to send it back on changes requested.
 * Returns null at either end of the board.
 */
export async function getAdjacentStage(
  db: SupabaseClient,
  stage: StageRules,
  direction: 1 | -1,
): Promise<StageRules | null> {
  const q = db.from('workflow_stages').select(STAGE_RULES_SELECT).eq('workflow_id', stage.workflow_id)
  const { data, error } = direction === 1
    ? await q.gt('sort_order', stage.sort_order).order('sort_order', { ascending: true }).limit(1)
    : await q.lt('sort_order', stage.sort_order).order('sort_order', { ascending: false }).limit(1)
  if (error) throw error
  return ((data ?? []) as StageRules[])[0] ?? null
}

export async function insertHandoff(
  db: SupabaseClient,
  row: {
    task_id: string
    owner_id: string
    from_stage_id: string | null
    to_stage_id: string | null
    from_user_id: string | null
    to_user_id: string | null
    actor_id: string | null
    kind: HandoffKind
    note: string | null
    held_seconds: number | null
  },
): Promise<void> {
  const { error } = await db.from('work_task_handoffs').insert(row)
  if (error) throw error
}

/**
 * The most recent pass of the baton for a task.
 *
 * Its `from_user_id` is who handed the work over, which is exactly who a
 * "changes requested" has to go back to — sending it to the stage's standing
 * owner instead would hand the rework to someone who never did the work.
 */
export async function getLastHandoff(
  db: SupabaseClient,
  taskId: string,
): Promise<{ from_stage_id: string | null; from_user_id: string | null } | null> {
  const { data, error } = await db
    .from('work_task_handoffs')
    .select('from_stage_id, from_user_id')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return ((data ?? []) as Array<{ from_stage_id: string | null; from_user_id: string | null }>)[0] ?? null
}

interface RawHandoff {
  id: string
  task_id: string
  from_stage_id: string | null
  to_stage_id: string | null
  from_user_id: string | null
  to_user_id: string | null
  actor_id: string | null
  kind: HandoffKind
  note: string | null
  held_seconds: number | null
  created_at: string
  from_stage: { name: string } | { name: string }[] | null
  to_stage: { name: string } | { name: string }[] | null
}

/**
 * The full chain for one task, newest first.
 *
 * Stage names are joined but user names come from the members map: a teammate
 * who has left the workspace still has to be nameable in the history, and the
 * FK is set to NULL when their account goes rather than deleting the row.
 */
export async function listHandoffs(db: SupabaseClient, taskId: string, ownerId: string): Promise<TaskHandoff[]> {
  const { data, error } = await db
    .from('work_task_handoffs')
    .select(`
      id, task_id, from_stage_id, to_stage_id, from_user_id, to_user_id, actor_id,
      kind, note, held_seconds, created_at,
      from_stage:from_stage_id ( name ),
      to_stage:to_stage_id ( name )
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const members = await getMembersMap(db, ownerId)
  const nameOf = (id: string | null): string | null => {
    if (!id) return null
    const m = members.get(id)
    return m?.name ?? m?.email ?? 'Former teammate'
  }

  return ((data ?? []) as RawHandoff[]).map((r) => ({
    id: r.id,
    task_id: r.task_id,
    from_stage_id: r.from_stage_id,
    to_stage_id: r.to_stage_id,
    from_user_id: r.from_user_id,
    to_user_id: r.to_user_id,
    actor_id: r.actor_id,
    kind: r.kind,
    note: r.note,
    held_seconds: r.held_seconds,
    created_at: r.created_at,
    from_stage_name: one(r.from_stage)?.name ?? null,
    to_stage_name: one(r.to_stage)?.name ?? null,
    from_user_name: nameOf(r.from_user_id),
    to_user_name: nameOf(r.to_user_id),
    actor_name: nameOf(r.actor_id),
  }))
}

/**
 * Everyone attached to a task: creator, current holder, and every assignee.
 *
 * Deliberately wider than "who is answerable" — this is the notification
 * audience, and someone who handed work on still wants to hear what became of
 * it. Narrowing to the baton holder happens in the digest, not here.
 */
export async function getTaskParticipants(db: SupabaseClient, taskId: string): Promise<string[]> {
  const [{ data: task }, { data: assignees }] = await Promise.all([
    db.from('work_tasks').select('created_by, responsible_id').eq('id', taskId).maybeSingle(),
    db.from('work_task_assignees').select('user_id').eq('task_id', taskId),
  ])
  const ids = new Set<string>()
  const row = task as { created_by?: string; responsible_id?: string | null } | null
  if (row?.created_by) ids.add(row.created_by)
  if (row?.responsible_id) ids.add(row.responsible_id)
  for (const a of (assignees ?? []) as { user_id: string }[]) ids.add(a.user_id)
  return [...ids]
}

export async function insertTask(db: SupabaseClient, row: Record<string, unknown>): Promise<{ id: string }> {
  const { data, error } = await db.from('work_tasks').insert(row).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateTaskRow(db: SupabaseClient, id: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('work_tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function softDeleteTask(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('work_tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// ── Assignees ─────────────────────────────────────────────────────────────────

export async function getAssigneeIds(db: SupabaseClient, taskId: string): Promise<string[]> {
  const { data, error } = await db.from('work_task_assignees').select('user_id').eq('task_id', taskId)
  if (error) throw error
  return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
}

export async function setAssignees(db: SupabaseClient, taskId: string, userIds: string[]): Promise<void> {
  const { error: delErr } = await db.from('work_task_assignees').delete().eq('task_id', taskId)
  if (delErr) throw delErr
  if (userIds.length === 0) return
  const { error } = await db.from('work_task_assignees').insert(userIds.map((user_id) => ({ task_id: taskId, user_id })))
  if (error) throw error
}

export async function addAssignee(db: SupabaseClient, taskId: string, userId: string): Promise<void> {
  const { error } = await db.from('work_task_assignees').upsert({ task_id: taskId, user_id: userId })
  if (error) throw error
}

export async function removeAssignee(db: SupabaseClient, taskId: string, userId: string): Promise<void> {
  const { error } = await db.from('work_task_assignees').delete().eq('task_id', taskId).eq('user_id', userId)
  if (error) throw error
}

// ── Subtasks ──────────────────────────────────────────────────────────────────

export async function getSubtaskParent(db: SupabaseClient, subtaskId: string): Promise<string | null> {
  const { data, error } = await db.from('work_subtasks').select('task_id').eq('id', subtaskId).maybeSingle()
  if (error) throw error
  return (data as { task_id: string } | null)?.task_id ?? null
}

export async function insertSubtask(
  db: SupabaseClient,
  row: { task_id: string; title: string; sort_order: number },
): Promise<Subtask> {
  const { data, error } = await db.from('work_subtasks').insert(row).select('*').single()
  if (error) throw error
  return data as Subtask
}

export async function updateSubtaskRow(
  db: SupabaseClient,
  id: string,
  updates: { title?: string; done?: boolean; sort_order?: number },
): Promise<void> {
  const { error } = await db.from('work_subtasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteSubtaskRow(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('work_subtasks').delete().eq('id', id)
  if (error) throw error
}

// ── Files (Cloudinary attachment metadata) ───────────────────────────────────────

export async function insertTaskFile(
  db: SupabaseClient,
  row: {
    task_id: string
    owner_id: string
    uploaded_by: string
    uploader_name: string | null
    file_name: string
    file_url: string
    public_id: string
    file_size: number | null
    file_type: string | null
  },
): Promise<TaskFileRow> {
  const { data, error } = await db
    .from('work_task_files')
    .insert(row)
    .select('id, file_name, file_url, public_id, file_size, file_type, uploader_name, created_at')
    .single()
  if (error) throw error
  return data as TaskFileRow
}

export async function getTaskFile(db: SupabaseClient, fileId: string): Promise<(TaskFileRow & { task_id: string }) | null> {
  const { data, error } = await db
    .from('work_task_files')
    .select('id, task_id, file_name, file_url, public_id, file_size, file_type, uploader_name, created_at')
    .eq('id', fileId)
    .maybeSingle()
  if (error) throw error
  return data as (TaskFileRow & { task_id: string }) | null
}

export async function deleteTaskFileRow(db: SupabaseClient, fileId: string): Promise<void> {
  const { error } = await db.from('work_task_files').delete().eq('id', fileId)
  if (error) throw error
}

// ── Project / contact metadata (for denormalizing the client link) ──────────────

export async function getProjectMeta(db: SupabaseClient, projectId: string): Promise<{
  owner_id: string; workspace_id: string | null; contact_id: string
} | null> {
  const { data, error } = await db
    .from('projects')
    .select('owner_id, workspace_id, contact_id')
    .eq('id', projectId)
    .maybeSingle()
  if (error) throw error
  return (data as never) ?? null
}

export async function getContactOwner(db: SupabaseClient, contactId: string): Promise<{ owner_id: string } | null> {
  const { data, error } = await db.from('crm_contacts').select('owner_id').eq('id', contactId).maybeSingle()
  if (error) throw error
  return (data as { owner_id: string } | null) ?? null
}
