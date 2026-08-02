import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient, createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as access from '@/repositories/client-team-access.repository'
import * as crmService from '@/services/crm.service'

/**
 * Which of the owner's team members a given client can see and assign tasks to.
 *
 * Same ownership proof as the portal-members route: `getContactById` runs on a
 * USER-scoped client so RLS confirms the contact belongs to the caller, and only
 * then is the service role used. Skipping that first step would let any signed-in
 * user rewrite any client's access list.
 */

async function requireOwnedContact(req: NextRequest, contactId: string) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return { response, ownerId: null }
  const userDb = createUserClient(token!)
  await crmService.getContactById(userDb, contactId, user!.id)
  return { response: null, ownerId: user!.id }
}

function missingContact() {
  return NextResponse.json(
    { error: { code: 'CRM_ACCESS_MISSING_CONTACT', message: 'contact_id is required.' } },
    { status: 400 },
  )
}

/**
 * GET /api/v1/crm/client-team-access?contact_id=...
 * Returns every workspace member plus which of them this client can reach.
 */
export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (!contactId) return missingContact()

  try {
    const { response, ownerId } = await requireOwnedContact(req, contactId)
    if (response) return response
    const db = createServiceClient()
    const [members, selected] = await Promise.all([
      access.listWorkspaceMembers(db, ownerId!),
      access.listAccessUserIds(db, contactId),
    ])
    return NextResponse.json({ members, selected })
  } catch (err) {
    return handleError(err, 'CRM_CLIENT_TEAM_ACCESS_LIST_FAILED')
  }
}

const putSchema = z.object({
  contact_id: z.string().uuid(),
  user_ids:   z.array(z.string().uuid()).max(200),
})

/** PUT /api/v1/crm/client-team-access — replaces the whole list for one client. */
export async function PUT(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json(
      { error: { code: 'CRM_ACCESS_INVALID', message: 'That request isn’t valid.' } },
      { status: 400 },
    )
  }

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) return missingContact()

  try {
    const { response, ownerId } = await requireOwnedContact(req, parsed.data.contact_id)
    if (response) return response

    const db = createServiceClient()
    // Only people who are actually in the owner's workspaces may be granted —
    // otherwise an arbitrary user id could be written into the access list.
    const valid = new Set((await access.listWorkspaceMembers(db, ownerId!)).map((m) => m.user_id))
    const userIds = parsed.data.user_ids.filter((id) => valid.has(id))

    await access.setAccess(db, parsed.data.contact_id, ownerId!, userIds)
    return NextResponse.json({ selected: userIds })
  } catch (err) {
    return handleError(err, 'CRM_CLIENT_TEAM_ACCESS_UPDATE_FAILED')
  }
}
