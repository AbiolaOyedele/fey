/**
 * Client-facing notifications — the owner → client direction.
 *
 * The app's own `notifications` table covers client → owner and is keyed to an
 * auth user. Portal users aren't auth users, so this is its own table with its
 * own recipient. Same idea, different audience: everything here is written for
 * a person logged into the client portal.
 */

export const PORTAL_NOTIFICATION_TYPES = [
  'message',
  'file',
  'contract',
  'form',
  'invoice',
  'payment',
  'task',
] as const
export type PortalNotificationType = (typeof PORTAL_NOTIFICATION_TYPES)[number]

export interface PortalNotification {
  id: string
  portal_user_id: string
  contact_id: string | null
  owner_id: string
  type: PortalNotificationType | string
  title: string
  body: string | null
  /**
   * Portal-relative path (e.g. '/messages'). Stored without the base because a
   * portal renders at both /client/* and /portal/<slug>/* depending on how it
   * was reached — the base is applied at render time.
   */
  link: string | null
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
}

/**
 * Which categories a client wants to hear about. One flag per notification
 * type; a missing row means everything is on, so existing clients keep their
 * current behaviour without a backfill.
 */
export interface PortalNotificationPrefs {
  portal_user_id: string
  owner_id: string
  messages: boolean
  files: boolean
  contracts: boolean
  forms: boolean
  invoices: boolean
  tasks: boolean
  updated_at: string
}

/** Maps a notification type to the preference flag that gates it. */
export const PREF_KEY_FOR_TYPE: Record<PortalNotificationType, keyof PortalNotificationPrefs> = {
  message: 'messages',
  file: 'files',
  contract: 'contracts',
  form: 'forms',
  invoice: 'invoices',
  payment: 'invoices',
  task: 'tasks',
}

/** GET /api/v1/portal/notifications */
export interface ListPortalNotificationsResponse {
  notifications: PortalNotification[]
  unread: number
}
