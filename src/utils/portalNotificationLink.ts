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
      // A stored link that already names this task is MORE specific than
      // anything rebuilt from the entity alone — it can carry which tab to open,
      // which is how a "ready for review" notification lands on the deliverable
      // rather than on the task's details. Rebuilding is still the answer for
      // the old rows this function exists for, which stored a bare '/tasks'.
      case 'task':
        return n.link?.includes(`taskId=${id}`) ? n.link : `/tasks?taskId=${encodeURIComponent(id)}`
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
