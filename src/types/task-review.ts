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

/** One file inside a version. A version may carry several. */
export interface ReviewFile {
  id: string
  file_name: string
  file_url: string
  public_id: string
  file_size: number | null
  file_type: string | null
  sort_order: number
}

export interface ReviewVersion {
  id: string
  task_id: string
  version: number
  uploader_name: string | null
  uploader_type: ReviewAuthorType
  status: ReviewStatus
  /** Set once a newer version replaced this one. */
  superseded_at: string | null
  created_at: string
  // Joined:
  files: ReviewFile[]
  comments: ReviewComment[]
}

// ── API payloads ────────────────────────────────────────────────────────────

/** One uploaded file, as sent when recording a version. */
export interface ReviewFileInput {
  file_name: string
  file_url: string
  public_id: string
  file_size?: number | null
  file_type?: string | null
}

/** A version is created from one or more files in a single request. */
export interface CreateReviewVersionPayload {
  files: ReviewFileInput[]
}

export interface CreateReviewCommentPayload {
  body: string
  decision?: ReviewDecision | null
}

/**
 * Status pairings point at the app's tokens rather than hexes, so changing how
 * a status reads is a one-line edit in globals.css. These stay distinct from
 * the brand accent on purpose — "approved" and "changes requested" have to be
 * tellable apart whatever colour the workspace picks.
 */
export const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; bg: string; fg: string }> = {
  pending:           { label: 'Awaiting review',   bg: 'var(--neutral-soft)', fg: 'var(--neutral)' },
  approved:          { label: 'Approved',          bg: 'var(--success-soft)', fg: 'var(--success)' },
  changes_requested: { label: 'Changes requested', bg: 'var(--pending-soft)', fg: 'var(--pending)' },
}
