import * as React from 'react'
import { Resend } from 'resend'
import { env } from '@/config/env'
import { EMAIL_FROM, NO_REPLY, appUrl } from '@/config/email'
import { WorkspaceInviteEmail } from '../../emails/WorkspaceInviteEmail'
import { InviteAcceptedEmail } from '../../emails/InviteAcceptedEmail'
import { RoleChangedEmail } from '../../emails/RoleChangedEmail'
import { NewMessageEmail } from '../../emails/NewMessageEmail'
import { FeedbackEmail } from '../../emails/FeedbackEmail'
import { TaskDigestEmail, type DigestTask } from '../../emails/TaskDigestEmail'
import { WelcomeEmail } from '../../emails/WelcomeEmail'

/**
 * Single source of truth for outbound transactional email.
 *
 * Owns the one Resend instance and every send path. Sends are **best-effort**:
 * helpers never throw — a missing API key or a Resend failure returns a result
 * object so callers (often inside request handlers) are never blocked by mail.
 */

type SendResult = { ok: true; id?: string } | { ok: false; error: string }

interface SendEmailParams {
  from: string
  to: string | string[]
  subject: string
  /** A React Email element. Provide this OR `html`. */
  react?: React.ReactElement
  /** Raw HTML body. Provide this OR `react`. */
  html?: string
  text?: string
  replyTo?: string
}

let client: Resend | null = null

/** Lazily constructs the Resend client; returns null when no key is configured. */
function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null
  if (!client) client = new Resend(env.RESEND_API_KEY)
  return client
}

/**
 * Low-level send wrapper. Centralizes the Resend instance and swallows errors
 * into a {@link SendResult}. Use the typed helpers below for known emails;
 * use this directly only for free-form, user-authored bodies (e.g. invoices).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const resend = getClient()
  if (!resend) return { ok: false, error: 'EMAIL_NOT_CONFIGURED' }

  try {
    const { from, to, subject, react, html, text, replyTo } = params
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      replyTo: replyTo ?? NO_REPLY,
      ...(react ? { react } : {}),
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    } as Parameters<typeof resend.emails.send>[0])

    if (error) {
      console.error('[EMAIL_SEND_FAILED]', error)
      return { ok: false, error: error.message }
    }
    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('[EMAIL_SEND_FAILED]', err)
    return { ok: false, error: 'EMAIL_SEND_EXCEPTION' }
  }
}

// ── Typed senders ────────────────────────────────────────────────────────────

/** Welcome — sent once, right after a new owner's first workspace is created. */
export function sendWelcomeEmail(
  to: string,
  props: { name: string; workspaceName: string; dashboardUrl: string },
): Promise<SendResult> {
  return sendEmail({
    from: EMAIL_FROM.team,
    to,
    subject: `Welcome to Fey — ${props.workspaceName} is ready`,
    react: WelcomeEmail(props),
  })
}

/** Workspace invite — sent to the invitee. */
export function sendWorkspaceInvite(
  to: string,
  props: { workspaceName: string; role: string; inviteUrl: string },
): Promise<SendResult> {
  return sendEmail({
    from: EMAIL_FROM.team,
    to,
    subject: `You’ve been invited to join ${props.workspaceName} on Fey`,
    react: WorkspaceInviteEmail(props),
  })
}

/** Invite accepted — sent to the inviter. */
export function sendInviteAccepted(
  to: string,
  props: { memberName: string; workspaceName: string },
): Promise<SendResult> {
  const workspaceUrl = `${appUrl()}/team`
  return sendEmail({
    from: EMAIL_FROM.team,
    to,
    subject: `${props.memberName} joined ${props.workspaceName}`,
    react: InviteAcceptedEmail({ ...props, workspaceUrl }),
  })
}

/** Role changed — sent to the affected member. */
export function sendRoleChanged(
  to: string,
  props: { memberName: string; workspaceName: string; newRole: string },
): Promise<SendResult> {
  const workspaceUrl = `${appUrl()}/team`
  return sendEmail({
    from: EMAIL_FROM.team,
    to,
    subject: `Your role in ${props.workspaceName} is now ${props.newRole}`,
    react: RoleChangedEmail({ ...props, workspaceUrl }),
  })
}

/** Feedback submission — sent to the admin allowlist (best-effort). */
export function sendFeedbackNotification(
  to: string | string[],
  props: { type: string; message: string; fromEmail: string; source: string; pageUrl?: string | null },
): Promise<SendResult> {
  return sendEmail({
    from: EMAIL_FROM.notifications,
    to,
    subject: `New ${props.type} feedback from ${props.fromEmail}`,
    react: FeedbackEmail(props),
    ...(props.fromEmail ? { replyTo: props.fromEmail } : {}),
  })
}

/** Daily task digest — due/overdue, recently assigned, completed yesterday (best-effort). */
export function sendTaskDigest(
  to: string,
  props: { dueOrOverdue: DigestTask[]; recentlyAssigned: DigestTask[]; completedYesterday: DigestTask[]; tasksUrl: string },
): Promise<SendResult> {
  const unsubscribeUrl = `${appUrl()}/settings?tab=App`
  return sendEmail({
    from: EMAIL_FROM.notifications,
    to,
    subject: 'Your daily task digest',
    react: TaskDigestEmail({ ...props, unsubscribeUrl }),
  })
}

/** New internal-chat message — sent to other workspace members (best-effort). */
export function sendNewMessageAlert(
  to: string,
  props: {
    workspaceName: string
    channelName: string
    senderName: string
    snippet: string
    channelUrl: string
    unsubscribeUrl: string
  },
): Promise<SendResult> {
  return sendEmail({
    from: EMAIL_FROM.notifications,
    to,
    subject: `${props.senderName} posted in #${props.channelName} (${props.workspaceName})`,
    react: NewMessageEmail(props),
  })
}
