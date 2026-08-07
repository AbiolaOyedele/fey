// The Review tab on a task — the deliverable that was produced, versioned, and
// the notes the team and the client left on it.
// See supabase/migrations/20260807_task_review_versions.sql.

/** How many versions a task keeps. The oldest is pruned past this. */
export const MAX_REVIEW_VERSIONS = 3

export type ReviewStatus = 'pending' | 'approved' | 'changes_requested'

/** A ruling attached to a note. Comment-only notes carry none. */
export type ReviewDecision = Exclude<ReviewStatus, 'pending'>

/** Which side of the portal a note came from. */
export type ReviewAuthorType = 'team' | 'client'

export interface ReviewComment {
  id: string
  review_id: string
  author_name: string | null
  author_type: ReviewAuthorType
  body: string
  decision: ReviewDecision | null
  created_at: string
}

export interface ReviewVersion {
  id: string
  task_id: string
  version: number
  file_name: string
  file_url: string
  public_id: string
  file_size: number | null
  file_type: string | null
  uploader_name: string | null
  uploader_type: ReviewAuthorType
  status: ReviewStatus
  /** Set once a newer version replaced this one. */
  superseded_at: string | null
  created_at: string
  // Joined:
  comments: ReviewComment[]
}

// ── API payloads ────────────────────────────────────────────────────────────

export interface CreateReviewVersionPayload {
  file_name: string
  file_url: string
  public_id: string
  file_size?: number | null
  file_type?: string | null
}

export interface CreateReviewCommentPayload {
  body: string
  decision?: ReviewDecision | null
}

export const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; bg: string; fg: string }> = {
  pending:           { label: 'Awaiting review',   bg: '#F3F4F6', fg: '#6B7280' },
  approved:          { label: 'Approved',          bg: '#ECFDF5', fg: '#059669' },
  changes_requested: { label: 'Changes requested', bg: '#FFFAF0', fg: '#C05621' },
}
