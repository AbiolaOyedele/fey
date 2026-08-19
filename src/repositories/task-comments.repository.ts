import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskComment } from '@/types/work-tasks'

const SELECT = 'id, task_id, author_id, portal_author_id, body, created_at, edited_at'

/**
 * The same thread, with the client's name resolved.
 *
 * A comment has one author of one of two kinds — a teammate (auth user) or a
 * client (portal user) — so the portal name is joined here rather than looked up
 * per row by the caller. Teammate names come from the workspace roster the
 * caller already holds.
 */
const SELECT_WITH_PORTAL_AUTHOR =
  'id, task_id, author_id, portal_author_id, body, created_at, edited_at, portal_users:portal_author_id ( name )'

export async function listComments(db: SupabaseClient, taskId: string): Promise<TaskComment[]> {
  const { data, error } = await db
    .from('task_comments')
    .select(SELECT)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TaskComment[]
}

export async function insertComment(
  db: SupabaseClient,
  row: { task_id: string; author_id?: string; portal_author_id?: string; body: string },
): Promise<TaskComment> {
  const { data, error } = await db.from('task_comments').insert(row).select(SELECT).single()
  if (error) throw error
  return data as TaskComment
}

export async function getCommentById(db: SupabaseClient, id: string): Promise<TaskComment | null> {
  const { data, error } = await db.from('task_comments').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as TaskComment | null) ?? null
}

export async function updateCommentRow(db: SupabaseClient, id: string, body: string): Promise<TaskComment> {
  const { data, error } = await db
    .from('task_comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return data as TaskComment
}

export async function deleteCommentRow(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('task_comments').delete().eq('id', id)
  if (error) throw error
}

/**
 * A task's whole thread, both sides of it, for the portal.
 *
 * Service-role: portal users have no policy on this table, so the caller is
 * responsible for having already established that this client may see the task.
 */
export async function listCommentsForPortal(
  db: SupabaseClient,
  taskId: string,
): Promise<Array<TaskComment & { portal_author_name: string | null }>> {
  const { data, error } = await db
    .from('task_comments')
    .select(SELECT_WITH_PORTAL_AUTHOR)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    // PostgREST returns an embedded row as an object or a one-element array
    // depending on how it infers the relationship; normalise both.
    const embedded = row.portal_users as { name?: string } | Array<{ name?: string }> | null
    const one = Array.isArray(embedded) ? embedded[0] : embedded
    const { portal_users: _drop, ...rest } = row
    return { ...(rest as unknown as TaskComment), portal_author_name: one?.name ?? null }
  })
}
