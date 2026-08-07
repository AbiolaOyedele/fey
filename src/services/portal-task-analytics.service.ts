import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import * as portalRepo from '@/repositories/portal.repository'
import { getTaskAnalytics } from '@/services/task-analytics.service'
import type { TaskAnalytics } from '@/types/task-analytics'

/**
 * The Progress panel a client sees in their portal.
 *
 * Two things make this its own service rather than a call straight through to
 * the app's analytics:
 *
 *  1. **Scope.** Like everything else in the portal, this runs on a
 *     service-role client with no RLS behind it. The contact id is forced in
 *     here from the verified token and the caller's `input` is never allowed to
 *     carry one, so a client cannot widen the query to a workspace-wide read or
 *     point it at another client. See portal-tasks.service.ts for the same rule
 *     on the task list.
 *
 *  2. **What a client is shown.** Per-teammate figures are internal — a client
 *     has no business seeing which of the team is carrying overdue work — and
 *     a per-client breakdown is meaningless in a portal that only ever contains
 *     one client. Both are stripped below rather than merely hidden in the UI,
 *     so they can't leak through the API even if a panel is changed later.
 */

export interface PortalAnalyticsScope {
  contactId: string
  ownerId: string
}

/** What the portal is allowed to ask for. Notably absent: any id. */
export interface PortalAnalyticsInput {
  range?: string | null
  tzOffset?: number
}

export async function getPortalTaskAnalytics(
  db: SupabaseClient,
  scope: PortalAnalyticsScope,
  input: PortalAnalyticsInput,
): Promise<TaskAnalytics> {
  // The switch is read fresh on every request rather than trusted from the
  // token: an owner who turns this off should stop serving the numbers
  // immediately, not whenever the client's session happens to expire.
  const contact = await portalRepo.getContactById(db, scope.contactId)
  if (!contact || contact.owner_id !== scope.ownerId) {
    throw new AppError(404, 'That client could not be found.', 'PORTAL_ANALYTICS_CONTACT_NOT_FOUND')
  }
  if (!contact.portal_insights_enabled) {
    throw new AppError(403, 'Progress isn’t switched on for this portal.', 'PORTAL_ANALYTICS_DISABLED')
  }

  const analytics = await getTaskAnalytics(db, scope.ownerId, {
    range: input.range ?? undefined,
    tzOffset: input.tzOffset ?? 0,
    // Forced, never taken from the request. Everything downstream is fenced to
    // this one client by the repository's `.eq('contact_id', …)`.
    contactId: scope.contactId,
    projectId: null,
    assigneeId: null,
  })
  // No viewer is passed: member narrowing is an agency-side rule, and the
  // contact filter above is already the tighter fence.

  return {
    ...analytics,
    // Internal. Stripped at the API boundary, not just in the UI.
    people: [],
    // Always a single row — this client — so it says nothing worth a tab.
    clients: [],
  }
}
