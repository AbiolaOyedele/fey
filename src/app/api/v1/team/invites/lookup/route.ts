import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError, errorResponse } from '@/lib/api-helpers'

/**
 * GET /api/v1/team/invites/lookup?token=...
 * Public — resolves a pending invite so the accept screen can show the
 * workspace name and lock the email field. Returns 404 for invalid/used tokens.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return errorResponse('TEAM_INVITE_NO_TOKEN', 'Missing invite token.', 400)

  try {
    const db = createServiceClient()
    const { data: invite } = await db
      .from('workspace_invites')
      .select('email, role, status, workspace_id')
      .eq('token', token)
      .maybeSingle()

    const inv = invite as { email: string; role: string; status: string; workspace_id: string } | null
    if (!inv || inv.status !== 'pending') {
      return errorResponse('TEAM_INVITE_INVALID', 'This invite is no longer valid.', 404)
    }

    const { data: ws } = await db.from('workspaces').select('name').eq('id', inv.workspace_id).maybeSingle()
    return NextResponse.json({
      email: inv.email,
      role: inv.role,
      workspaceName: (ws as { name: string } | null)?.name ?? 'a workspace',
    })
  } catch (err) {
    return handleError(err, 'TEAM_INVITE_LOOKUP_FAILED')
  }
}
