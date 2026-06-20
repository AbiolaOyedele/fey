import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppNotification, PushSubscriptionJSON } from '@/types/notification'

/**
 * Notification + push-subscription queries. Reads use a user-scoped client
 * (RLS: recipient_id = auth.uid()); inserts use the service role (notifications
 * are written for other users, which RLS forbids from the client).
 */

interface InsertNotification {
  recipient_id: string
  workspace_id: string | null
  actor_id: string | null
  type: string
  title: string
  body: string | null
  link: string | null
  entity_type: string | null
  entity_id: string | null
}

export async function insertNotifications(db: SupabaseClient, rows: InsertNotification[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await db.from('notifications').insert(rows)
  if (error) throw error
}

export async function listNotifications(db: SupabaseClient, recipientId: string, limit = 50): Promise<AppNotification[]> {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function markRead(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function markAllRead(db: SupabaseClient, recipientId: string): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', recipientId)
    .is('read_at', null)
  if (error) throw error
}

// ── Recipient resolution ────────────────────────────────────────────────────────

/** owner + admins of every workspace owned by ownerId (and the owner themselves). */
export async function getOwnerAndAdmins(db: SupabaseClient, ownerId: string): Promise<string[]> {
  const { data, error } = await db
    .from('workspace_members')
    .select('user_id, role, workspaces!inner ( owner_id )')
    .eq('workspaces.owner_id', ownerId)
    .in('role', ['owner', 'admin'])
  if (error) throw error
  const ids = new Set<string>([ownerId])
  for (const r of (data ?? []) as Array<{ user_id: string }>) ids.add(r.user_id)
  return [...ids]
}

// ── Push subscriptions ──────────────────────────────────────────────────────────

export async function upsertSubscription(
  db: SupabaseClient,
  row: { user_id: string; endpoint: string; p256dh: string; auth: string; user_agent: string | null },
): Promise<void> {
  const { error } = await db.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function deleteSubscription(db: SupabaseClient, endpoint: string): Promise<void> {
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}

export async function getSubscriptionsForUsers(db: SupabaseClient, userIds: string[]): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
  if (userIds.length === 0) return []
  const { data, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (error) throw error
  return (data ?? []) as Array<{ endpoint: string; p256dh: string; auth: string }>
}

export function toPushJSON(s: { endpoint: string; p256dh: string; auth: string }): PushSubscriptionJSON {
  return { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
}
