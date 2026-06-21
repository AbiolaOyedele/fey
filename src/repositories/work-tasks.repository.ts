import type { SupabaseClient } from '@supabase/supabase-js'
import type { Task, Subtask, TaskAssignee, TaskScope } from '@/types/work-tasks'

/**
 * All task queries (work_tasks + assignees + subtasks). Callers pass a
 * user-scoped client (RLS enforced) for owner actions, or a service-role client
 * for the portal (after the route verifies the portal JWT).
 */

const SELECT = `
  id, owner_id, workspace_id, project_id, contact_id, stage_id, created_by, visibility,
  title, description, priority, start_date, due_date, estimated_minutes,
  logged_minutes, sort_order, done, completed_at, created_at, updated_at,
  work_task_assignees ( user_id ),
  work_subtasks ( id, task_id, title, done, sort_order ),
  projects:project_id ( title ),
  crm_contacts:contact_id ( name )
`

interface RawTask {
  id: string
  owner_id: string
  workspace_id: string | null
  project_id: string | null
  contact_id: string | null
  stage_id: string | null
  created_by: string
  visibility: Task['visibility']
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
  projects: { title: string } | { title: string }[] | null
  crm_contacts: { name: string } | { name: string }[] | null
}

type MemberInfo = { name: string | null; email: string | null }

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
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
    visibility: row.visibility ?? 'personal',
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
    subtasks: (row.work_subtasks ?? []).sort((a, b) => a.sort_order - b.sort_order),
    project_title: one(row.projects)?.title ?? null,
    contact_name: one(row.crm_contacts)?.name ?? null,
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
  return rows.map((r) => mapTask(r, members))
}

export async function getTaskById(db: SupabaseClient, id: string): Promise<Task | null> {
  const { data, error } = await db.from('work_tasks').select(SELECT).eq('id', id).is('deleted_at', null).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as RawTask
  const members = await getMembersMap(db, row.owner_id)
  return mapTask(row, members)
}

/** Lightweight fetch (no joins) — used for ownership re-checks in the service. */
export async function getTaskCore(db: SupabaseClient, id: string): Promise<{
  id: string; owner_id: string; workspace_id: string | null; project_id: string | null
  contact_id: string | null; created_by: string; done: boolean
} | null> {
  const { data, error } = await db
    .from('work_tasks')
    .select('id, owner_id, workspace_id, project_id, contact_id, created_by, done')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return (data as never) ?? null
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
