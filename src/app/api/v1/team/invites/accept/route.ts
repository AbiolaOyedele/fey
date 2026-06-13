import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'

const bodySchema = z.object({ token: z.string().min(8) })

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
  try {
    token = bodySchema.parse(await req.json()).token
  } catch {
    return errorResponse('TEAM_ACCEPT_INVALID_INPUT', 'Invalid invite.', 400)
  }

  try {
    const db = createServiceClient()

    const { data: invite } = await db
      .from('workspace_invites')
      .select('id, workspace_id, email, role, status')
      .eq('token', token)
      .maybeSingle()

    if (!invite || (invite as { status: string }).status !== 'pending') {
      return errorResponse('TEAM_ACCEPT_INVALID', 'This invite is no longer valid.', 404)
    }
    const inv = invite as { id: string; workspace_id: string; email: string; role: 'admin' | 'member' }

    const callerEmail = (user!.email ?? '').toLowerCase()
    if (callerEmail !== inv.email.toLowerCase()) {
      return errorResponse('TEAM_ACCEPT_EMAIL_MISMATCH', 'This invite was sent to a different email address.', 403)
    }

    const displayName =
      (user!.user_metadata?.full_name as string | undefined) ??
      (user!.user_metadata?.name as string | undefined) ??
      callerEmail.split('@')[0]

    const { error: memberErr } = await db.from('workspace_members').upsert(
      { workspace_id: inv.workspace_id, user_id: user!.id, role: inv.role, email: callerEmail, name: displayName },
      { onConflict: 'workspace_id,user_id' },
    )
    if (memberErr) throw memberErr

    await db.from('workspace_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', inv.id)

    return NextResponse.json({ ok: true, workspace_id: inv.workspace_id })
  } catch (err) {
    return handleError(err, 'TEAM_ACCEPT_FAILED')
  }
}
