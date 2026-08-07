import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ReviewAuthorType, ReviewComment, ReviewDecision, ReviewFile, ReviewStatus, ReviewVersion,
} from '@/types/task-review'

/**
 * Queries for task review versions and their notes.
 *
 * Callers pass a user-scoped client (RLS enforced) for the app, or a
 * service-role client for the portal — after the route has verified the portal
 * JWT and the service has fenced the task to that client's contact.
 */

const SELECT = `
  id, task_id, version,
  uploaded_by, uploaded_by_portal_user, uploader_name, status, superseded_at, created_at,
  work_task_review_files (
    id, file_name, file_url, public_id, file_size, file_type, sort_order
  ),
  work_task_review_comments (
    id, review_id, author_name, author_type, body, decision, created_at
  )
`

interface RawReview {
  id: string
  task_id: string
  version: number
  uploaded_by: string | null
  uploaded_by_portal_user: string | null
  uploader_name: string | null
  status: ReviewStatus
  superseded_at: string | null
  created_at: string
  work_task_review_files: ReviewFile[] | null
  work_task_review_comments: ReviewComment[] | null
}

function mapReview(row: RawReview): ReviewVersion {
  return {
    id: row.id,
    task_id: row.task_id,
    version: row.version,
    uploader_name: row.uploader_name,
    uploader_type: row.uploaded_by_portal_user ? 'client' : 'team',
    status: row.status,
    superseded_at: row.superseded_at,
    created_at: row.created_at,
    files: (row.work_task_review_files ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    comments: (row.work_task_review_comments ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }
}

/** Every version of a task's deliverable, newest first. */
export async function listReviews(db: SupabaseClient, taskId: string): Promise<ReviewVersion[]> {
  const { data, error } = await db
    .from('work_task_reviews')
    .select(SELECT)
    .eq('task_id', taskId)
    .order('version', { ascending: false })
  if (error) throw error
  return ((data ?? []) as RawReview[]).map(mapReview)
}

export async function getReview(db: SupabaseClient, reviewId: string): Promise<ReviewVersion | null> {
  const { data, error } = await db.from('work_task_reviews').select(SELECT).eq('id', reviewId).maybeSingle()
  if (error) throw error
  return data ? mapReview(data as RawReview) : null
}

/** The highest version number used on this task, including pruned ones. */
export async function highestVersion(db: SupabaseClient, taskId: string): Promise<number> {
  const { data, error } = await db
    .from('work_task_reviews')
    .select('version')
    .eq('task_id', taskId)
    .order('version', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data as Array<{ version: number }> | null)?.[0]?.version ?? 0
}

/** Version rows oldest-first — used to work out what to prune. */
export interface PrunableVersion {
  id: string
  version: number
  /** Every binary this version owns, so pruning can clean all of them up. */
  work_task_review_files: Array<{ public_id: string; file_url: string }> | null
}

export async function listVersionsAsc(db: SupabaseClient, taskId: string): Promise<PrunableVersion[]> {
  const { data, error } = await db
    .from('work_task_reviews')
    .select('id, version, work_task_review_files ( public_id, file_url )')
    .eq('task_id', taskId)
    .order('version', { ascending: true })
  if (error) throw error
  return (data ?? []) as PrunableVersion[]
}

/** Files belonging to a version, written in one go after the version row. */
export async function insertReviewFiles(
  db: SupabaseClient,
  rows: Array<{
    review_id: string
    task_id: string
    file_name: string
    file_url: string
    public_id: string
    file_size: number | null
    file_type: string | null
    sort_order: number
  }>,
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await db.from('work_task_review_files').insert(rows)
  if (error) throw error
}

export async function insertReview(
  db: SupabaseClient,
  row: {
    task_id: string
    owner_id: string
    version: number
    uploaded_by: string | null
    uploaded_by_portal_user: string | null
    uploader_name: string | null
  },
): Promise<{ id: string }> {
  const { data, error } = await db.from('work_task_reviews').insert(row).select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Marks every earlier version of this task as no longer current. */
export async function supersedeEarlier(
  db: SupabaseClient,
  taskId: string,
  belowVersion: number,
): Promise<void> {
  const { error } = await db
    .from('work_task_reviews')
    .update({ superseded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('task_id', taskId)
    .lt('version', belowVersion)
    .is('superseded_at', null)
  if (error) throw error
}

export async function setReviewStatus(
  db: SupabaseClient,
  reviewId: string,
  status: ReviewStatus,
): Promise<void> {
  const { error } = await db
    .from('work_task_reviews')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', reviewId)
  if (error) throw error
}

export async function deleteReviewRow(db: SupabaseClient, reviewId: string): Promise<void> {
  const { error } = await db.from('work_task_reviews').delete().eq('id', reviewId)
  if (error) throw error
}

// ── Notes ────────────────────────────────────────────────────────────────────

export async function insertComment(
  db: SupabaseClient,
  row: {
    review_id: string
    task_id: string
    owner_id: string
    author_id: string | null
    author_portal_user: string | null
    author_name: string | null
    author_type: ReviewAuthorType
    body: string
    decision: ReviewDecision | null
  },
): Promise<ReviewComment> {
  const { data, error } = await db
    .from('work_task_review_comments')
    .insert(row)
    .select('id, review_id, author_name, author_type, body, decision, created_at')
    .single()
  if (error) throw error
  return data as ReviewComment
}
