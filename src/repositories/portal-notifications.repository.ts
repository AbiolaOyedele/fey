import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PortalNotification,
  PortalNotificationPrefs,
  PortalNotificationType,
} from '@/types/portal-notification'

/**
 * Queries for portal_notifications / portal_notification_prefs.
 *
 * Portal users log in with a custom JWT rather than Supabase Auth, so there is
 * no auth.uid() for RLS to match. Every caller here passes a SERVICE-ROLE
 * client after verifying the portal token, and scoping is enforced in the
 * arguments — the same pattern the rest of the portal repositories use.
 * Queries only, no business logic.
 */

const SELECT = `
  id, portal_user_id, contact_id, owner_id, type, title, body, link,
  entity_type, entity_id, read_at, created_at
`

export interface InsertPortalNotification {
  portal_user_id: string
  contact_id: string | null
  owner_id: string
  type: PortalNotificationType | string
  title: string
  body: string | null
  link: string | null
  entity_type: string | null
  entity_id: string | null
}

export async function insertMany(db: SupabaseClient, rows: InsertPortalNotification[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await db.from('portal_notifications').insert(rows)
  if (error) throw error
}

export async function listForPortalUser(
  db: SupabaseClient,
  portalUserId: string,
  limit = 50,
): Promise<PortalNotification[]> {
  const { data, error } = await db
    .from('portal_notifications')
    .select(SELECT)
    .eq('portal_user_id', portalUserId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as PortalNotification[]
}

export async function countUnread(db: SupabaseClient, portalUserId: string): Promise<number> {
  const { count, error } = await db
    .from('portal_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('portal_user_id', portalUserId)
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

/** Scoped by portal_user_id as well as id — a client can only read their own. */
export async function markRead(db: SupabaseClient, id: string, portalUserId: string): Promise<void> {
  const { error } = await db
    .from('portal_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('portal_user_id', portalUserId)
  if (error) throw error
}

export async function markAllRead(db: SupabaseClient, portalUserId: string): Promise<void> {
  const { error } = await db
    .from('portal_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('portal_user_id', portalUserId)
    .is('read_at', null)
  if (error) throw error
}

/** Every portal user attached to a contact — the recipients for a client-facing event. */
export async function portalUsersForContact(
  db: SupabaseClient,
  contactId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await db.from('portal_users').select('id, name').eq('contact_id', contactId)
  if (error) throw error
  return (data ?? []) as Array<{ id: string; name: string }>
}

// ── Preferences ──────────────────────────────────────────────────────────────

export async function getPrefs(db: SupabaseClient, portalUserId: string): Promise<PortalNotificationPrefs | null> {
  const { data, error } = await db
    .from('portal_notification_prefs')
    .select('*')
    .eq('portal_user_id', portalUserId)
    .maybeSingle()
  if (error) throw error
  return (data as PortalNotificationPrefs | null) ?? null
}

/** Batch read for the notify path — one query rather than one per recipient. */
export async function getPrefsFor(
  db: SupabaseClient,
  portalUserIds: string[],
): Promise<Map<string, PortalNotificationPrefs>> {
  if (portalUserIds.length === 0) return new Map()
  const { data, error } = await db
    .from('portal_notification_prefs')
    .select('*')
    .in('portal_user_id', portalUserIds)
  if (error) throw error
  const map = new Map<string, PortalNotificationPrefs>()
  for (const row of (data ?? []) as PortalNotificationPrefs[]) map.set(row.portal_user_id, row)
  return map
}

/**
 * Flags to change. Written out rather than `Partial<…>` because
 * exactOptionalPropertyTypes makes those two different types: Zod's `.optional()`
 * yields `boolean | undefined`, which a plain Partial rejects.
 */
export type PortalNotificationPrefsPatch = {
  [K in 'messages' | 'files' | 'contracts' | 'forms' | 'invoices' | 'tasks']?: boolean | undefined
}

export async function upsertPrefs(
  db: SupabaseClient,
  scope: { portal_user_id: string; owner_id: string },
  patch: PortalNotificationPrefsPatch,
): Promise<PortalNotificationPrefs> {
  const { data, error } = await db
    .from('portal_notification_prefs')
    .upsert(
      { ...scope, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'portal_user_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data as PortalNotificationPrefs
}
