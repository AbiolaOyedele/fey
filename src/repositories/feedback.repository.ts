import type { SupabaseClient } from '@supabase/supabase-js'
import type { Feedback, FeedbackStatus } from '@/types/feedback'

interface InsertFeedbackRow {
  user_id: string | null
  workspace_id: string | null
  source: string
  type: string
  message: string
  page_url: string | null
  user_agent: string | null
}

/** Inserts a feedback row. `db` should be the user-scoped client (RLS applies). */
export async function insertFeedback(
  db: SupabaseClient,
  row: InsertFeedbackRow,
): Promise<Feedback> {
  const { data, error } = await db
    .from('feedback')
    .insert(row)
    .select('*')
    .single()
  if (error) throw error
  return data as Feedback
}

/**
 * Lists all feedback, newest first. Intended for the admin board — pass a
 * service-role client (bypasses RLS). Optionally filter by status.
 */
export async function listAllFeedback(
  db: SupabaseClient,
  status?: FeedbackStatus,
): Promise<Feedback[]> {
  let query = db.from('feedback').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Feedback[]
}

/** Updates a feedback row's status. Admin-only (service-role client). */
export async function updateFeedbackStatus(
  db: SupabaseClient,
  id: string,
  status: FeedbackStatus,
): Promise<void> {
  const { error } = await db.from('feedback').update({ status }).eq('id', id)
  if (error) throw error
}
