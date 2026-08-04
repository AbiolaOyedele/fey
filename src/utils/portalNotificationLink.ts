import type { PortalNotification } from '@/types/portal-notification'

/**
 * Where a notification should actually take the client.
 *
 * Derived from `entity_type` + `entity_id` first, and only from the stored
 * `link` as a fallback. That ordering is deliberate: notifications written
 * before this existed stored a section path ('/tasks') with no id, so a client
 * tapping "Moved to Review" landed on the board and had to hunt for the task
 * that was just announced to them. The entity has been recorded all along, so
 * resolving from it repairs those rows too — no backfill.
 *
 * The returned path is portal-relative; the caller prefixes the portal base.
 */
export function portalNotificationHref(n: Pick<PortalNotification, 'link' | 'entity_type' | 'entity_id'>): string {
  const id = n.entity_id
  if (id) {
    switch (n.entity_type) {
      case 'task':            return `/tasks?taskId=${encodeURIComponent(id)}`
      case 'crm_contract':    return `/contracts/${id}`
      case 'crm_form':        return `/forms/${id}`
      case 'crm_message':     return `/messages?messageId=${encodeURIComponent(id)}`
      case 'project':         return `/projects/${id}`
      case 'project_message': return `/projects/${id}`
      default:                break // fall through to the stored link
    }
  }
  return n.link ?? '/notifications'
}
