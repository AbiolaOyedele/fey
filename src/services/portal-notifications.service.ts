import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { createServiceClient } from '@/lib/supabase-server'
import * as repo from '@/repositories/portal-notifications.repository'
import {
  PREF_KEY_FOR_TYPE,
  type ListPortalNotificationsResponse,
  type PortalNotification,
  type PortalNotificationPrefs,
  type PortalNotificationType,
} from '@/types/portal-notification'

/**
 * The owner → client notification direction.
 *
 * `notifyClient` is called from the owner's own actions (sending a message,
 * sharing a file, issuing a contract…) and fans the event out to every portal
 * user attached to that contact — a contact can have more than one person with
 * portal access, and all of them should hear about it.
 *
 * Like the app's `notify`, this NEVER throws: a notification failing must not
 * fail the action that triggered it. The owner sending a message is the real
 * work; telling the client is a side effect.
 */

export interface NotifyClientArgs {
  /** Service-role client — portal users aren't auth users, so RLS can't scope this. */
  db: SupabaseClient
  contactId: string
  ownerId: string
  type: PortalNotificationType
  title: string
  body?: string | null
  /** Portal-relative path, e.g. '/messages'. The base is applied at render time. */
  link?: string | null
  entityType?: string | null
  entityId?: string | null
}

export async function notifyClient(args: NotifyClientArgs): Promise<void> {
  try {
    await notifyClientInner(args)
  } catch (err) {
    console.warn('[notifyClient] failed:', err)
  }
}

/**
 * Fire-and-forget wrapper that brings its own service-role client.
 *
 * Portal notifications have no client-facing insert policy, so this needs the
 * service role no matter which caller triggered it — pushing that detail into
 * every call site meant the same three lines repeated in each service. Not
 * awaited: telling the client must never delay or fail the owner's action.
 */
export function announceToClient(args: Omit<NotifyClientArgs, 'db'>): void {
  void notifyClient({ db: createServiceClient(), ...args })
}

async function notifyClientInner(args: NotifyClientArgs): Promise<void> {
  const recipients = await repo.portalUsersForContact(args.db, args.contactId)
  if (recipients.length === 0) return // contact has no portal access yet

  // Respect each recipient's preferences. A missing row means "everything on",
  // so a client who has never touched their settings still gets notified.
  const prefKey = PREF_KEY_FOR_TYPE[args.type]
  const prefs = await repo.getPrefsFor(args.db, recipients.map((r) => r.id))
  const wanted = recipients.filter((r) => {
    const row = prefs.get(r.id)
    return row ? row[prefKey] !== false : true
  })
  if (wanted.length === 0) return

  await repo.insertMany(
    args.db,
    wanted.map((r) => ({
      portal_user_id: r.id,
      contact_id: args.contactId,
      owner_id: args.ownerId,
      type: args.type,
      title: args.title,
      body: args.body ?? null,
      link: args.link ?? null,
      entity_type: args.entityType ?? null,
      entity_id: args.entityId ?? null,
    })),
  )
}

// ── Reads (the portal's own bell + list) ─────────────────────────────────────

export async function listForClient(
  db: SupabaseClient,
  portalUserId: string,
): Promise<ListPortalNotificationsResponse> {
  const [notifications, unread] = await Promise.all([
    repo.listForPortalUser(db, portalUserId),
    repo.countUnread(db, portalUserId),
  ])
  return { notifications, unread }
}

export async function markRead(db: SupabaseClient, portalUserId: string, id: string): Promise<void> {
  await repo.markRead(db, id, portalUserId)
}

export async function markAllRead(db: SupabaseClient, portalUserId: string): Promise<void> {
  await repo.markAllRead(db, portalUserId)
}

// ── Preferences ──────────────────────────────────────────────────────────────

/** Absent row = everything on, so a client who never opened settings is unaffected. */
export const DEFAULT_PREFS = {
  messages: true,
  files: true,
  contracts: true,
  forms: true,
  invoices: true,
  tasks: true,
} as const

export async function getPrefs(
  db: SupabaseClient,
  portalUserId: string,
): Promise<Omit<PortalNotificationPrefs, 'portal_user_id' | 'owner_id' | 'updated_at'>> {
  const row = await repo.getPrefs(db, portalUserId)
  if (!row) return { ...DEFAULT_PREFS }
  return {
    messages: row.messages,
    files: row.files,
    contracts: row.contracts,
    forms: row.forms,
    invoices: row.invoices,
    tasks: row.tasks,
  }
}

const prefsSchema = z
  .object({
    messages: z.boolean().optional(),
    files: z.boolean().optional(),
    contracts: z.boolean().optional(),
    forms: z.boolean().optional(),
    invoices: z.boolean().optional(),
    tasks: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Choose at least one setting to change.')

export async function updatePrefs(
  db: SupabaseClient,
  scope: { portal_user_id: string; owner_id: string },
  input: unknown,
): Promise<PortalNotificationPrefs> {
  const parsed = prefsSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, 'That notification setting isn’t valid.', 'PORTAL_NOTIF_PREFS_INVALID')
  }
  return repo.upsertPrefs(db, scope, parsed.data)
}

/** Groups a list into Today / Earlier for the notifications UI. */
export function splitByRecency(items: PortalNotification[]): {
  today: PortalNotification[]
  earlier: PortalNotification[]
} {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const cutoff = startOfToday.getTime()
  return {
    today: items.filter((n) => new Date(n.created_at).getTime() >= cutoff),
    earlier: items.filter((n) => new Date(n.created_at).getTime() < cutoff),
  }
}
