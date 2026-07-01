import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Queries for the daily task-digest email (src/services/task-digest.service.ts).
 * Assignee/creator-centric: a user's digest covers tasks assigned to them (any
 * workspace) plus their own personal (unlinked) tasks — not everything in every
 * workspace they belong to.
 */

export interface DigestRecipient {
  userId: string
  email: string
}

export interface DigestTaskRow {
  id: string
  title: string
  due_date: string | null
  priority: 'low' | 'medium' | 'high'
  contact_id: string | null
  project_id: string | null
  workspace_id: string | null
}

const TASK_SELECT = 'id, title, due_date, priority, contact_id, project_id, workspace_id'

function dedupeById(rows: DigestTaskRow[]): DigestTaskRow[] {
  const seen = new Map<string, DigestTaskRow>()
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, r)
  return [...seen.values()]
}

/** Every user with the digest enabled, resolved to an email via their workspace membership. */
export async function getDigestRecipients(db: SupabaseClient): Promise<DigestRecipient[]> {
  const { data: settingsRows, error: settingsErr } = await db
    .from('fey_settings')
    .select('user_id')
    .neq('task_digest_enabled', 'false')
  if (settingsErr) throw settingsErr
  const userIds = [...new Set((settingsRows ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean))]
  if (userIds.length === 0) return []

  const { data: memberRows, error: memberErr } = await db
    .from('workspace_members')
    .select('user_id, email')
    .in('user_id', userIds)
  if (memberErr) throw memberErr

  const emailByUser = new Map<string, string>()
  for (const r of (memberRows ?? []) as Array<{ user_id: string; email: string | null }>) {
    if (r.email && !emailByUser.has(r.user_id)) emailByUser.set(r.user_id, r.email)
  }
  return userIds.filter((id) => emailByUser.has(id)).map((id) => ({ userId: id, email: emailByUser.get(id)! }))
}

/** task_ids assigned to userId (any workspace). */
async function getAssignedTaskIds(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await db.from('work_task_assignees').select('task_id').eq('user_id', userId)
  if (error) throw error
  return ((data ?? []) as Array<{ task_id: string }>).map((r) => r.task_id)
}

/** task_ids assigned to userId since a given timestamp (for "recently assigned"). */
async function getAssignedTaskIdsSince(db: SupabaseClient, userId: string, sinceISO: string): Promise<string[]> {
  const { data, error } = await db
    .from('work_task_assignees')
    .select('task_id')
    .eq('user_id', userId)
    .gte('assigned_at', sinceISO)
  if (error) throw error
  return ((data ?? []) as Array<{ task_id: string }>).map((r) => r.task_id)
}

/** Tasks assigned to or created personally by userId, not done, due today or earlier. */
export async function getDueOrOverdueTasksForUser(db: SupabaseClient, userId: string, todayISO: string): Promise<DigestTaskRow[]> {
  const assignedIds = await getAssignedTaskIds(db, userId)

  const queries = [
    db.from('work_tasks').select(TASK_SELECT).eq('created_by', userId)
      .is('deleted_at', null).eq('done', false).not('due_date', 'is', null).lte('due_date', todayISO),
  ]
  if (assignedIds.length > 0) {
    queries.push(
      db.from('work_tasks').select(TASK_SELECT).in('id', assignedIds)
        .is('deleted_at', null).eq('done', false).not('due_date', 'is', null).lte('due_date', todayISO),
    )
  }

  const results = await Promise.all(queries)
  for (const r of results) if (r.error) throw r.error
  return dedupeById(results.flatMap((r) => (r.data ?? []) as DigestTaskRow[]))
}

/** Tasks assigned to userId in the last `sinceISO`..now window. */
export async function getRecentlyAssignedTasksForUser(db: SupabaseClient, userId: string, sinceISO: string): Promise<DigestTaskRow[]> {
  const ids = await getAssignedTaskIdsSince(db, userId, sinceISO)
  if (ids.length === 0) return []
  const { data, error } = await db.from('work_tasks').select(TASK_SELECT).in('id', ids).is('deleted_at', null)
  if (error) throw error
  return dedupeById((data ?? []) as DigestTaskRow[])
}

/** Tasks userId created or is assigned to, completed within [startISO, endISO). */
export async function getCompletedInRangeForUser(
  db: SupabaseClient, userId: string, startISO: string, endISO: string,
): Promise<DigestTaskRow[]> {
  const assignedIds = await getAssignedTaskIds(db, userId)

  const queries = [
    db.from('work_tasks').select(TASK_SELECT).eq('created_by', userId)
      .is('deleted_at', null).eq('done', true).gte('completed_at', startISO).lt('completed_at', endISO),
  ]
  if (assignedIds.length > 0) {
    queries.push(
      db.from('work_tasks').select(TASK_SELECT).in('id', assignedIds)
        .is('deleted_at', null).eq('done', true).gte('completed_at', startISO).lt('completed_at', endISO),
    )
  }

  const results = await Promise.all(queries)
  for (const r of results) if (r.error) throw r.error
  return dedupeById(results.flatMap((r) => (r.data ?? []) as DigestTaskRow[]))
}

/** Resolves workspace_id → name for a set of tasks, so the digest can label which workspace each task belongs to. */
export async function getWorkspaceNames(db: SupabaseClient, workspaceIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(workspaceIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  const { data, error } = await db.from('workspaces').select('id, name').in('id', ids)
  if (error) throw error
  return new Map(((data ?? []) as Array<{ id: string; name: string }>).map((w) => [w.id, w.name]))
}

export async function hasAlreadySentDigest(db: SupabaseClient, userId: string, digestDate: string): Promise<boolean> {
  const { data, error } = await db
    .from('daily_digest_log')
    .select('user_id')
    .eq('user_id', userId)
    .eq('digest_date', digestDate)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

export async function logDigestSent(db: SupabaseClient, userId: string, digestDate: string): Promise<void> {
  const { error } = await db.from('daily_digest_log').insert({ user_id: userId, digest_date: digestDate })
  if (error) throw error
}
