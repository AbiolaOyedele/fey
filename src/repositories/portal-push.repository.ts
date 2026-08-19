import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Web Push subscriptions belonging to portal clients.
 *
 * Separate from `push_subscriptions` because that table is keyed on auth.users
 * and portal clients are not auth users. Every caller here passes a service-role
 * client: the table has no policy for portal users, by design.
 */

export interface PortalPushRow {
  portal_user_id: string
  owner_id:       string
  endpoint:       string
  p256dh:         string
  auth:           string
  base_path:      string
  user_agent:     string | null
}

/** One row per device — re-subscribing on the same device updates in place. */
export async function upsertSubscription(db: SupabaseClient, row: PortalPushRow): Promise<void> {
  const { error } = await db
    .from('portal_push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function deleteSubscription(db: SupabaseClient, endpoint: string): Promise<void> {
  const { error } = await db.from('portal_push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}

/** Drops endpoints the push service has told us are gone. */
export async function deleteSubscriptions(db: SupabaseClient, endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return
  const { error } = await db.from('portal_push_subscriptions').delete().in('endpoint', endpoints)
  if (error) throw error
}

export async function getSubscriptionsForPortalUsers(
  db: SupabaseClient,
  portalUserIds: string[],
): Promise<Array<{ endpoint: string; p256dh: string; auth: string; base_path: string }>> {
  if (portalUserIds.length === 0) return []
  const { data, error } = await db
    .from('portal_push_subscriptions')
    .select('endpoint, p256dh, auth, base_path')
    .in('portal_user_id', portalUserIds)
  if (error) throw error
  return (data ?? []) as Array<{ endpoint: string; p256dh: string; auth: string; base_path: string }>
}
