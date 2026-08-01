import { NextRequest, NextResponse } from 'next/server'
import { createUserClient, createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as members from '@/services/portal-members.service'
import * as crmService from '@/services/crm.service'

/**
 * The owner's view of a client's portal members — the CRM side of the same
 * roles the client manages themselves.
 *
 * Ownership is proved before anything else: `getContactById` runs on a
 * USER-scoped client so RLS confirms this contact really belongs to the caller.
 * Only then does the service role come out, because portal_users has no policy
 * a user client could read it through. Without that first step the service-role
 * client would happily return any contact's members.
 */

async function requireOwnedContact(req: NextRequest, contactId: string) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return { response, ownerId: null }
  const userDb = createUserClient(token!)
  // Throws 404 via AppError if the contact isn't theirs.
  await crmService.getContactById(userDb, contactId, user!.id)
  return { response: null, ownerId: user!.id }
}

/** GET /api/v1/crm/portal-members?contact_id=... */
export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (!contactId) {
    return NextResponse.json(
      { error: { code: 'CRM_MEMBERS_MISSING_CONTACT', message: 'contact_id is required.' } },
      { status: 400 },
    )
  }
  try {
    const { response } = await requireOwnedContact(req, contactId)
    if (response) return response
    const list = await members.listMembers(createServiceClient(), contactId)
    return NextResponse.json({ members: list })
  } catch (err) {
    return handleError(err, 'CRM_PORTAL_MEMBERS_LIST_FAILED')
  }
}

/** PATCH /api/v1/crm/portal-members — the owner may set any member's role. */
export async function PATCH(req: NextRequest) {
  let body: { contact_id?: string } & Record<string, unknown>
  try {
    body = (await req.json()) as { contact_id?: string } & Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: { code: 'CRM_MEMBERS_INVALID', message: 'That request isn’t valid.' } },
      { status: 400 },
    )
  }
  if (!body.contact_id) {
    return NextResponse.json(
      { error: { code: 'CRM_MEMBERS_MISSING_CONTACT', message: 'contact_id is required.' } },
      { status: 400 },
    )
  }

  try {
    const { response, ownerId } = await requireOwnedContact(req, body.contact_id)
    if (response) return response
    const member = await members.setMemberRole(
      createServiceClient(),
      { contactId: body.contact_id, ownerId: ownerId! },
      { kind: 'owner' },
      body,
    )
    return NextResponse.json({ member })
  } catch (err) {
    return handleError(err, 'CRM_PORTAL_MEMBERS_UPDATE_FAILED')
  }
}
