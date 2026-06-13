import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'

/**
 * DELETE /api/v1/workspace/[workspaceId]
 * Permanently deletes a workspace. Only the workspace OWNER may do this. The
 * delete cascades to members, invites, and the internal channels/messages
 * (all FK ON DELETE CASCADE). It does NOT touch the owner's CRM data, which is
 * keyed on owner_id independently.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { workspaceId } = await params

  try {
    const db = createServiceClient()

    const { data: ws } = await db
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', workspaceId)
      .maybeSingle()
    if (!ws) return errorResponse('WORKSPACE_NOT_FOUND', 'Workspace not found.', 404)
    if ((ws as { owner_id: string }).owner_id !== user!.id) {
      return errorResponse('WORKSPACE_DELETE_FORBIDDEN', 'Only the workspace owner can delete it.', 403)
    }

    const { error } = await db.from('workspaces').delete().eq('id', workspaceId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'WORKSPACE_DELETE_FAILED')
  }
}
