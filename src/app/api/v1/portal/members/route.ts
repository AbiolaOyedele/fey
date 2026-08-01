import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as members from '@/services/portal-members.service'

/**
 * The client's own team — everyone with access to this portal.
 *
 * Scoped entirely by the verified portal token's contact_id, so a client can
 * only ever see and manage their own people. Whether the caller may actually
 * change a role is decided in the service, not here.
 */

/** GET /api/v1/portal/members */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const list = await members.listMembers(db, payload!.contact_id)
    return NextResponse.json({ members: list, me: payload!.portal_user_id })
  } catch (err) {
    return handleError(err, 'PORTAL_MEMBERS_LIST_FAILED')
  }
}

/** PATCH /api/v1/portal/members — client_admin only, enforced in the service. */
export async function PATCH(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'PORTAL_MEMBER_INVALID', message: 'That request isn’t valid.' } },
      { status: 400 },
    )
  }

  const db = createServiceClient()
  try {
    const member = await members.setMemberRole(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      { kind: 'portal_user', portalUserId: payload!.portal_user_id },
      body,
    )
    return NextResponse.json({ member })
  } catch (err) {
    return handleError(err, 'PORTAL_MEMBER_UPDATE_FAILED')
  }
}
