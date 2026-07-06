import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskComment } from '@/types/work-tasks'

const SELECT = 'id, task_id, author_id, body, created_at, edited_at'

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
  row: { task_id: string; author_id: string; body: string },
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
