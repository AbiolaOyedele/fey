/** Feedback / feature-request domain types. */

export type FeedbackSource = 'owner' | 'portal'
export type FeedbackType = 'bug' | 'feature' | 'other'
export type FeedbackStatus = 'new' | 'triaged' | 'done'

export interface Feedback {
  id: string
  user_id: string | null
  workspace_id: string | null
  source: FeedbackSource
  type: FeedbackType
  message: string
  page_url: string | null
  user_agent: string | null
  status: FeedbackStatus
  created_at: string
}

export interface CreateFeedbackPayload {
  type: FeedbackType
  message: string
  page_url?: string | null
  workspace_id?: string | null
  source?: FeedbackSource
}
