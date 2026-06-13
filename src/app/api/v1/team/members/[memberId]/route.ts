import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { getMemberRole, isManager } from '@/lib/team-auth'

const patchSchema = z.object({ role: z.enum(['admin', 'member']) })

interface MemberRow { id: string; workspace_id: string; user_id: string; role: 'owner' | 'admin' | 'member' }

async function loadMember(memberId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from('workspace_members')
    .select('id, workspace_id, user_id, role')
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

  let role: 'admin' | 'member'
  try {
    role = patchSchema.parse(await req.json()).role
  } catch {
    return errorResponse('TEAM_ROLE_INVALID_INPUT', 'Choose a valid role.', 400)
  }

  try {
    const { db, member } = await loadMember(memberId)
    if (!member) return errorResponse('TEAM_MEMBER_NOT_FOUND', 'Member not found.', 404)

    const callerRole = await getMemberRole(db, member.workspace_id, user!.id)
    if (!isManager(callerRole)) {
      return errorResponse('TEAM_ROLE_FORBIDDEN', 'You don’t have permission to change roles.', 403)
    }
    if (member.role === 'owner') {
      return errorResponse('TEAM_ROLE_OWNER_LOCKED', 'The workspace owner’s role can’t be changed.', 409)
    }

    const { error } = await db.from('workspace_members').update({ role }).eq('id', memberId)
    if (error) throw error
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
    const isSelf = member.user_id === user!.id
    if (!isManager(callerRole) && !isSelf) {
      return errorResponse('TEAM_REMOVE_FORBIDDEN', 'You don’t have permission to remove teammates.', 403)
    }

    const { error } = await db.from('workspace_members').delete().eq('id', memberId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'TEAM_MEMBER_REMOVE_FAILED')
  }
}
