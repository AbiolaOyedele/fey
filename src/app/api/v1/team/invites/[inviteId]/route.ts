import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { getMemberRole, isManager } from '@/lib/team-auth'

/**
 * DELETE /api/v1/team/invites/[inviteId]
 * Revokes a pending invite. Caller must be an owner/admin of the invite's
 * workspace.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { inviteId } = await params

  try {
    const db = createServiceClient()
    const { data: invite } = await db
      .from('workspace_invites')
      .select('workspace_id, status')
      .eq('id', inviteId)
      .maybeSingle()
    if (!invite) return errorResponse('TEAM_INVITE_NOT_FOUND', 'Invite not found.', 404)

    const role = await getMemberRole(db, (invite as { workspace_id: string }).workspace_id, user!.id)
    if (!isManager(role)) {
      return errorResponse('TEAM_INVITE_FORBIDDEN', 'You don’t have permission to manage invites.', 403)
    }

    const { error } = await db.from('workspace_invites').update({ status: 'revoked' }).eq('id', inviteId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'TEAM_INVITE_REVOKE_FAILED')
  }
}
