import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as members from '@/services/portal-members.service'
import * as portalRepo from '@/repositories/portal.repository'

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

/**
 * POST /api/v1/portal/members — a client_admin adds one of their colleagues.
 *
 * Creates the account with no password. They can't sign in until they complete
 * signup with the workspace invite code, which claims this row rather than
 * creating a second identity for the same email.
 */
export async function POST(req: NextRequest) {
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
    // The invite email needs the contact's join code and who's adding them.
    // Both are read here rather than in the service so the service stays a pure
    // function of what it's given.
    const [contact, me] = await Promise.all([
      portalRepo.getContactById(db, payload!.contact_id),
      portalRepo.getPortalUser(db, payload!.portal_user_id),
    ])

    const member = await members.invitePortalMember(
      db,
      {
        contactId:     payload!.contact_id,
        ownerId:       payload!.owner_id,
        workspaceSlug: payload!.workspace_slug,
        inviteCode:    (contact as { invite_code?: string | null } | null)?.invite_code ?? null,
        ...(me ? { inviterName: me.name } : {}),
      },
      { kind: 'portal_user', portalUserId: payload!.portal_user_id },
      body,
    )
    return NextResponse.json({ member }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_MEMBER_INVITE_FAILED')
  }
}

/** DELETE /api/v1/portal/members?id=<portal_user_id> — client_admin only. */
export async function DELETE(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json(
      { error: { code: 'PORTAL_MEMBER_INVALID', message: 'No member was specified.' } },
      { status: 400 },
    )
  }

  const db = createServiceClient()
  try {
    await members.removeMember(
      db,
      { contactId: payload!.contact_id },
      { kind: 'portal_user', portalUserId: payload!.portal_user_id },
      id,
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'PORTAL_MEMBER_REMOVE_FAILED')
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
