import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError, errorResponse } from '@/lib/api-helpers'
import { sendNewMessageAlert } from '@/services/email.service'
import { appUrl } from '@/config/email'
import { env } from '@/config/env'

/** Supabase DB-webhook payload for an internal_messages INSERT. */
const payloadSchema = z.object({
  record: z.object({
    id:           z.string().uuid(),
    channel_id:   z.string().uuid(),
    workspace_id: z.string().uuid(),
    sender_id:    z.string().uuid(),
    body:         z.string(),
  }),
})

const ALERT_TYPE = 'chat_message'
const DEBOUNCE_MINUTES = 5
const SNIPPET_MAX = 200

interface MemberRow { user_id: string; email: string | null; name: string | null }
interface PrefRow { user_id: string; chat_messages: boolean; unsubscribe_token: string }

/**
 * POST /api/v1/internal/messages/notify
 *
 * Triggered by a Supabase Database Webhook on `internal_messages` INSERT (the
 * chat insert happens client-side, so there's no app route to hook). Emails an
 * alert to every other workspace member who has alerts on, debounced per
 * channel so a burst of messages produces at most one email per recipient
 * every {@link DEBOUNCE_MINUTES} minutes.
 *
 * Auth: shared secret in the `x-webhook-secret` header (no user session).
 */
export async function POST(req: NextRequest) {
  // 1. Verify the shared secret. Disabled entirely until the secret is set.
  const secret = env.EMAIL_WEBHOOK_SECRET
  if (!secret) {
    return errorResponse('ALERT_WEBHOOK_DISABLED', 'Alert webhook is not configured.', 503)
  }
  if (req.headers.get('x-webhook-secret') !== secret) {
    return errorResponse('ALERT_WEBHOOK_UNAUTHORIZED', 'Unauthorized.', 401)
  }

  // 2. Parse the webhook payload.
  let record: z.infer<typeof payloadSchema>['record']
  try {
    record = payloadSchema.parse(await req.json()).record
  } catch {
    return errorResponse('ALERT_WEBHOOK_INVALID_PAYLOAD', 'Invalid payload.', 400)
  }
  const { channel_id, workspace_id, sender_id, body } = record

  try {
    const db = createServiceClient()

    // 3. Resolve channel name, sender display name, and workspace name (a
    //    member can belong to several workspaces, so every alert must say
    //    which one it's from).
    const [{ data: channel }, { data: sender }, { data: workspace }] = await Promise.all([
      db.from('internal_channels').select('name').eq('id', channel_id).maybeSingle(),
      db.from('workspace_members')
        .select('name, email')
        .eq('workspace_id', workspace_id)
        .eq('user_id', sender_id)
        .maybeSingle(),
      db.from('workspaces').select('name').eq('id', workspace_id).maybeSingle(),
    ])
    const channelName = (channel as { name: string } | null)?.name ?? 'general'
    const senderRow = sender as { name: string | null; email: string | null } | null
    const senderName = senderRow?.name ?? senderRow?.email?.split('@')[0] ?? 'A teammate'
    const workspaceName = (workspace as { name: string } | null)?.name ?? 'your workspace'

    // 4. Recipients = workspace members with an email, excluding the sender.
    const { data: membersData } = await db
      .from('workspace_members')
      .select('user_id, email, name')
      .eq('workspace_id', workspace_id)
      .neq('user_id', sender_id)
    const recipients = ((membersData ?? []) as MemberRow[]).filter(
      (m): m is MemberRow & { email: string } => Boolean(m.email),
    )
    if (recipients.length === 0) return NextResponse.json({ sent: 0 })

    const recipientIds = recipients.map((m) => m.user_id)

    // 5. Ensure a preferences row exists for each recipient (default: alerts on),
    //    then load preferences + unsubscribe tokens.
    await db.from('notification_preferences').upsert(
      recipientIds.map((user_id) => ({ user_id, workspace_id })),
      { onConflict: 'user_id,workspace_id', ignoreDuplicates: true },
    )
    const { data: prefsData } = await db
      .from('notification_preferences')
      .select('user_id, chat_messages, unsubscribe_token')
      .eq('workspace_id', workspace_id)
      .in('user_id', recipientIds)
    const prefByUser = new Map(
      ((prefsData ?? []) as PrefRow[]).map((p) => [p.user_id, p]),
    )

    // 6. Debounce: who was already alerted for this channel recently?
    const cutoff = new Date(Date.now() - DEBOUNCE_MINUTES * 60_000).toISOString()
    const { data: recentLogs } = await db
      .from('email_alert_log')
      .select('recipient_email')
      .eq('alert_type', ALERT_TYPE)
      .eq('ref_id', channel_id)
      .gte('sent_at', cutoff)
    const recentlyAlerted = new Set(
      ((recentLogs ?? []) as { recipient_email: string }[]).map((r) => r.recipient_email),
    )

    // 7. Send to eligible recipients.
    const base = appUrl()
    const channelUrl = `${base}/playground`
    const snippet =
      body.length > SNIPPET_MAX ? `${body.slice(0, SNIPPET_MAX).trimEnd()}…` : body

    const sentEmails: string[] = []
    await Promise.all(
      recipients.map(async (m) => {
        const pref = prefByUser.get(m.user_id)
        if (pref && pref.chat_messages === false) return
        if (recentlyAlerted.has(m.email)) return

        const unsubscribeUrl = pref
          ? `${base}/api/v1/notifications/unsubscribe?token=${pref.unsubscribe_token}`
          : `${base}/settings`
        const result = await sendNewMessageAlert(m.email, {
          workspaceName,
          channelName,
          senderName,
          snippet,
          channelUrl,
          unsubscribeUrl,
        })
        if (result.ok) sentEmails.push(m.email)
      }),
    )

    // 8. Record what we sent so the next burst is debounced.
    if (sentEmails.length > 0) {
      await db.from('email_alert_log').insert(
        sentEmails.map((recipient_email) => ({
          recipient_email,
          alert_type: ALERT_TYPE,
          ref_id: channel_id,
        })),
      )
    }

    return NextResponse.json({ sent: sentEmails.length })
  } catch (err) {
    return handleError(err, 'ALERT_WEBHOOK_FAILED')
  }
}
