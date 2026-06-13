import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { sendInviteAccepted } from '@/services/email.service'

const bodySchema = z.object({ token: z.string().min(8), name: z.string().trim().min(1).max(80).optional() })

/**
 * POST /api/v1/team/invites/accept
 * Accepts a pending invite for the authenticated user. The invite email must
 * match the caller's email (a leaked token can't add the wrong account). On
 * success the user becomes a workspace_member with the invited role.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let token: string
  let providedName: string | undefined
  try {
    const parsed = bodySchema.parse(await req.json())
    token = parsed.token
    providedName = parsed.name
  } catch {
    return errorResponse('TEAM_ACCEPT_INVALID_INPUT', 'Invalid invite.', 400)
  }

  try {
    const db = createServiceClient()

    const { data: invite } = await db
      .from('workspace_invites')
      .select('id, workspace_id, email, role, status, invited_by')
      .eq('token', token)
      .maybeSingle()

    if (!invite || (invite as { status: string }).status !== 'pending') {
      return errorResponse('TEAM_ACCEPT_INVALID', 'This invite is no longer valid.', 404)
    }
    const inv = invite as {
      id: string
      workspace_id: string
      email: string
      role: 'admin' | 'member'
      invited_by: string
    }

    const callerEmail = (user!.email ?? '').toLowerCase()
    if (callerEmail !== inv.email.toLowerCase()) {
      return errorResponse('TEAM_ACCEPT_EMAIL_MISMATCH', 'This invite was sent to a different email address.', 403)
    }

    // Prefer the name the teammate typed on the accept screen, then their
    // provider profile, then the email prefix.
    const displayName =
      providedName ??
      (user!.user_metadata?.full_name as string | undefined) ??
      (user!.user_metadata?.name as string | undefined) ??
      callerEmail.split('@')[0]

    const { error: memberErr } = await db.from('workspace_members').upsert(
      { workspace_id: inv.workspace_id, user_id: user!.id, role: inv.role, email: callerEmail, name: displayName },
      { onConflict: 'workspace_id,user_id' },
    )
    if (memberErr) throw memberErr

    await db.from('workspace_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', inv.id)

    // Best-effort: tell the inviter their invite was accepted. The inviter's
    // email lives on their denormalized workspace_members row. sendInviteAccepted
    // never throws, so a mail failure can't break invite acceptance.
    const [{ data: inviter }, { data: ws }] = await Promise.all([
      db.from('workspace_members')
        .select('email')
        .eq('workspace_id', inv.workspace_id)
        .eq('user_id', inv.invited_by)
        .maybeSingle(),
      db.from('workspaces').select('name').eq('id', inv.workspace_id).maybeSingle(),
    ])
    const inviterEmail = (inviter as { email: string | null } | null)?.email
    if (inviterEmail) {
      const workspaceName = (ws as { name: string } | null)?.name ?? 'your workspace'
      await sendInviteAccepted(inviterEmail, { memberName: displayName, workspaceName })
    }

    return NextResponse.json({ ok: true, workspace_id: inv.workspace_id })
  } catch (err) {
    return handleError(err, 'TEAM_ACCEPT_FAILED')
  }
}
