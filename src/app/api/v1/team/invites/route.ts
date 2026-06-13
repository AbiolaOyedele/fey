import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { getMemberRole, isManager, generateInviteToken } from '@/lib/team-auth'
import { env } from '@/config/env'

const bodySchema = z.object({
  workspace_id: z.string().uuid(),
  email:        z.string().email(),
  role:         z.enum(['admin', 'member']),
})

/**
 * POST /api/v1/team/invites
 * Creates (or refreshes) a pending invite for an email. Caller must be an
 * owner/admin of the workspace. Sends the invite link via Resend when
 * configured; the link is always returned so it can be copied manually.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch {
    return errorResponse('TEAM_INVITE_INVALID_INPUT', 'Enter a valid email and role.', 400)
  }
  const { workspace_id, email, role } = parsed
  const emailLower = email.toLowerCase()

  try {
    const db = createServiceClient()

    // RBAC — only owners/admins may invite.
    const callerRole = await getMemberRole(db, workspace_id, user!.id)
    if (!isManager(callerRole)) {
      return errorResponse('TEAM_INVITE_FORBIDDEN', 'You don’t have permission to invite teammates.', 403)
    }

    // Already a member?
    const { data: existing } = await db
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .ilike('email', emailLower)
      .maybeSingle()
    if (existing) {
      return errorResponse('TEAM_INVITE_ALREADY_MEMBER', 'That person is already on your team.', 409)
    }

    // Replace any prior pending invite for this email.
    await db.from('workspace_invites')
      .update({ status: 'revoked' })
      .eq('workspace_id', workspace_id)
      .eq('status', 'pending')
      .ilike('email', emailLower)

    const token = generateInviteToken()
    const { error: insErr } = await db.from('workspace_invites').insert({
      workspace_id, email: emailLower, role, token, invited_by: user!.id, status: 'pending',
    })
    if (insErr) throw insErr

    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    const host  = req.headers.get('host') ?? (env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency')
    const inviteUrl = `${proto}://${host}/team/accept?token=${token}`

    // Best-effort email — never block the invite on a mail failure.
    if (env.RESEND_API_KEY) {
      try {
        const { data: ws } = await db.from('workspaces').select('name').eq('id', workspace_id).maybeSingle()
        const wsName = (ws as { name: string } | null)?.name ?? 'a workspace'
        const resend = new Resend(env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'Fey <team@feyapp.com>',
          to: emailLower,
          subject: `You’ve been invited to join ${wsName} on Fey`,
          html: `<p>You’ve been invited to join <strong>${wsName}</strong> as a ${role}.</p>
                 <p><a href="${inviteUrl}">Accept your invite</a></p>
                 <p>If you didn’t expect this, you can ignore this email.</p>`,
        })
      } catch { /* email is best-effort */ }
    }

    return NextResponse.json({ invite_url: inviteUrl })
  } catch (err) {
    return handleError(err, 'TEAM_INVITE_FAILED')
  }
}
