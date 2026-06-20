// Recipient-based in-app notifications + Web Push.

export type NotificationType =
  | 'client_message'
  | 'client_signup'
  | 'task_assigned'
  | 'project_message'
  | 'project_file'
  | 'invoice_paid'
  | 'form_submitted'
  | 'contract_signed'

export interface AppNotification {
  id: string
  recipient_id: string
  workspace_id: string | null
  actor_id: string | null
  type: NotificationType | string
  title: string
  body: string | null
  /** In-app path to open when clicked, e.g. /clients/123/messages */
  link: string | null
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
}

export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}
