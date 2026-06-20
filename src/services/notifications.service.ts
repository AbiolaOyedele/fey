import type { SupabaseClient } from '@supabase/supabase-js'
import * as repo from '@/repositories/notifications.repository'
import { sendPush } from '@/lib/push'
import { env } from '@/config/env'
import type { NotificationType } from '@/types/notification'

/**
 * Creates in-app notifications for a set of recipients and best-effort sends a
 * Web Push to each. Must be called with a SERVICE-ROLE client (notifications are
 * written for other users, which RLS forbids from a user client). The actor is
 * never notified about their own action.
 */
interface NotifyArgs {
  db: SupabaseClient
  recipientIds: string[]
  workspaceId?: string | null
  actorId?: string | null
  type: NotificationType | string
  title: string
  body?: string | null
  link?: string | null
  entityType?: string | null
  entityId?: string | null
}

function appBaseUrl(): string {
  const root = env.NEXT_PUBLIC_ROOT_DOMAIN
  return env.NEXT_PUBLIC_APP_URL ?? (root ? `https://dashboard.${root}` : '')
}

export async function notify(args: NotifyArgs): Promise<void> {
  // Notifications are never allowed to break the action that triggered them.
  try {
    await notifyInner(args)
  } catch (err) {
    console.warn('[notify] failed:', err)
  }
}

async function notifyInner(args: NotifyArgs): Promise<void> {
  const recipients = [...new Set(args.recipientIds)].filter((id) => id && id !== args.actorId)
  if (recipients.length === 0) return

  await repo.insertNotifications(
    args.db,
    recipients.map((recipient_id) => ({
      recipient_id,
      workspace_id: args.workspaceId ?? null,
      actor_id: args.actorId ?? null,
      type: args.type,
      title: args.title,
      body: args.body ?? null,
      link: args.link ?? null,
      entity_type: args.entityType ?? null,
      entity_id: args.entityId ?? null,
    })),
  )

  // Best-effort push — never fails the originating action.
  try {
    const subs = await repo.getSubscriptionsForUsers(args.db, recipients)
    if (subs.length > 0) {
      const { staleEndpoints } = await sendPush(
        subs.map(repo.toPushJSON),
        { title: args.title, body: args.body ?? '', url: args.link ? `${appBaseUrl()}${args.link}` : appBaseUrl(), tag: args.type },
      )
      await Promise.all(staleEndpoints.map((e) => repo.deleteSubscription(args.db, e).catch(() => undefined)))
    }
  } catch {
    /* push is best-effort */
  }
}

/** Convenience: notify the workspace owner + admins (account-wide events). */
export async function notifyOwnerAdmins(
  db: SupabaseClient,
  ownerId: string,
  args: Omit<NotifyArgs, 'db' | 'recipientIds'>,
): Promise<void> {
  try {
    const recipients = await repo.getOwnerAndAdmins(db, ownerId)
    await notify({ db, recipientIds: recipients, ...args })
  } catch (err) {
    console.warn('[notifyOwnerAdmins] failed:', err)
  }
}
