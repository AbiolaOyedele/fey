import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { getMemberRole, getWorkspaceCapabilities, isManager } from '@/lib/team-auth'
import { sendRoleChanged } from '@/services/email.service'
import type { WorkspaceRole } from '@/types/team'

// 'owner' is deliberately absent — ownership transfer isn't this endpoint's job.
const patchSchema = z.object({ role: z.enum(['super_admin', 'admin', 'member']) })

interface MemberRow {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  email: string | null
  name: string | null
}

async function loadMember(memberId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, email, name')
    .eq('id', memberId)
    .maybeSingle()
  return { db, member: data as MemberRow | null }
}

/**
 * PATCH /api/v1/team/members/[memberId]
 * Changes a member's role. Owner/admin only. The workspace owner's role can't
 * be changed here, and this endpoint can't grant 'owner'.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { memberId } = await params

  let role: 'super_admin' | 'admin' | 'member'
  try {
    role = patchSchema.parse(await req.json()).role
  } catch {
    return errorResponse('TEAM_ROLE_INVALID_INPUT', 'Choose a valid role.', 400)
  }

  try {
    const { db, member } = await loadMember(memberId)
    if (!member) return errorResponse('TEAM_MEMBER_NOT_FOUND', 'Member not found.', 404)

    const callerRole = await getMemberRole(db, member.workspace_id, user!.id)
    const capabilities = await getWorkspaceCapabilities(db, member.workspace_id)
    if (!isManager(callerRole, capabilities)) {
      return errorResponse('TEAM_ROLE_FORBIDDEN', 'You don’t have permission to change roles.', 403)
    }
    // Only the owner may mint another full-access admin — a granted `team`
    // capability must not become a route to handing out unrestricted access.
    if (role === 'super_admin' && callerRole !== 'owner') {
      return errorResponse('TEAM_ROLE_FORBIDDEN', 'Only the workspace owner can make someone a super admin.', 403)
    }
    if (member.role === 'owner') {
      return errorResponse('TEAM_ROLE_OWNER_LOCKED', 'The workspace owner’s role can’t be changed.', 409)
    }

    const { error } = await db.from('workspace_members').update({ role }).eq('id', memberId)
    if (error) throw error

    // Best-effort: notify the member their role changed. sendRoleChanged never throws.
    if (member.email) {
      const { data: ws } = await db
        .from('workspaces')
        .select('name')
        .eq('id', member.workspace_id)
        .maybeSingle()
      const workspaceName = (ws as { name: string } | null)?.name ?? 'your workspace'
      await sendRoleChanged(member.email, {
        memberName: member.name ?? member.email.split('@')[0],
        workspaceName,
        newRole: role,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'TEAM_ROLE_UPDATE_FAILED')
  }
}

/**
 * DELETE /api/v1/team/members/[memberId]
 * Removes a member. Owner/admin can remove any non-owner; a member may remove
 * themselves (leave). The workspace owner can't be removed.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { memberId } = await params

  try {
    const { db, member } = await loadMember(memberId)
    if (!member) return errorResponse('TEAM_MEMBER_NOT_FOUND', 'Member not found.', 404)

    if (member.role === 'owner') {
      return errorResponse('TEAM_REMOVE_OWNER_LOCKED', 'The workspace owner can’t be removed.', 409)
    }

    const callerRole = await getMemberRole(db, member.workspace_id, user!.id)
    const capabilities = await getWorkspaceCapabilities(db, member.workspace_id)
    const isSelf = member.user_id === user!.id
    if (!isManager(callerRole, capabilities) && !isSelf) {
      return errorResponse('TEAM_REMOVE_FORBIDDEN', 'You don’t have permission to remove teammates.', 403)
    }

    const { error } = await db.from('workspace_members').delete().eq('id', memberId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'TEAM_MEMBER_REMOVE_FAILED')
  }
}
