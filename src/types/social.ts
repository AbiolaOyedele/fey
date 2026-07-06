// Playground · Social Corner — content calendar types.
// See supabase/migrations/20260706_playground_social.sql. A brand is a calendar
// space (optionally linked to a CRM contact); posts sit on calendar dates and
// can be promoted to work_tasks so they surface on the main Tasks page.

export type SocialPostStatus = 'draft' | 'pending_review' | 'reviewed' | 'approved'

export type SocialPostFormat = 'static' | 'motion' | 'carousel' | 'story' | 'reel' | 'text'

export const SOCIAL_POST_STATUSES: { value: SocialPostStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'approved', label: 'Approved' },
]

export const SOCIAL_POST_FORMATS: { value: SocialPostFormat; label: string }[] = [
  { value: 'static', label: 'Static' },
  { value: 'motion', label: 'Motion' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'story', label: 'Story' },
  { value: 'reel', label: 'Reel' },
  { value: 'text', label: 'Text' },
]

/** Pastel brand palette — calendars stay soft and readable. */
export const SOCIAL_PASTEL_COLORS = [
  '#FBCFE8', // pink
  '#FED7AA', // peach
  '#FDE68A', // butter
  '#D9F99D', // lime
  '#A7F3D0', // mint
  '#A5F3FC', // sky
  '#C7D2FE', // periwinkle
  '#E9D5FF', // lilac
  '#FECACA', // blush
  '#E7E5E4', // stone
] as const

export interface SocialBrand {
  id: string
  contact_id: string | null
  /** Populated from crm_contacts when linked. */
  contact_name: string | null
  name: string
  color: string
  created_at: string
}

export interface SocialPost {
  id: string
  brand_id: string
  work_task_id: string | null
  scheduled_date: string
  scheduled_time: string | null
  title: string
  content_pillar: string | null
  format: SocialPostFormat | null
  visual_notes: string | null
  caption: string | null
  inspo_url: string | null
  status: SocialPostStatus
  created_at: string
  updated_at: string
}

export interface CreateBrandPayload {
  name: string
  color: string
  contact_id?: string | null
}

export interface UpdateBrandPayload {
  name?: string
  color?: string
  contact_id?: string | null
}

export interface CreatePostPayload {
  brand_id: string
  scheduled_date: string
  scheduled_time?: string | null
  title: string
  content_pillar?: string | null
  format?: SocialPostFormat | null
  visual_notes?: string | null
  caption?: string | null
  inspo_url?: string | null
  status?: SocialPostStatus
}

export interface UpdatePostPayload {
  brand_id?: string
  scheduled_date?: string
  scheduled_time?: string | null
  title?: string
  content_pillar?: string | null
  format?: SocialPostFormat | null
  visual_notes?: string | null
  caption?: string | null
  inspo_url?: string | null
  status?: SocialPostStatus
}
