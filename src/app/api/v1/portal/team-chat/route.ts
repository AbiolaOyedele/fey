import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as chat from '@/services/portal-team-chat.service'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * The client's private room — GET to read, POST to send, DELETE to unsend.
 *
 * `portal_team_messages` has RLS on and no policy whatsoever, so this route is
 * the only door. Everything is scoped by the contact_id on the verified portal
 * token; a body-supplied id is never trusted.
 */

async function actor(db: ReturnType<typeof createServiceClient>, portalUserId: string) {
  // Read fresh — a 30-day token must not outlive a demotion to viewer.
  return portalRepo.getPortalUser(db, portalUserId)
}

export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const messages = await chat.listMessages(db, payload!.contact_id)
    return NextResponse.json({ messages, me: payload!.portal_user_id })
  } catch (err) {
    return handleError(err, 'PORTAL_CHAT_LIST_FAILED')
  }
}

export async function POST(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PORTAL_CHAT_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createServiceClient()
  try {
    const me = await actor(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)

    const message = await chat.sendMessage(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      { id: me.id, role: me.role },
      body,
    )
    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_CHAT_SEND_FAILED')
  }
}

export async function DELETE(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  // No id means "clear the room" — the service checks that the caller may.
  const id = req.nextUrl.searchParams.get('id')

  const db = createServiceClient()
  try {
    const me = await actor(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)

    if (!id) {
      return NextResponse.json(await chat.clearMessages(db, { contactId: payload!.contact_id }, { role: me.role }))
    }
    await chat.deleteMessage(db, { contactId: payload!.contact_id }, { id: me.id, role: me.role }, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'PORTAL_CHAT_DELETE_FAILED')
  }
}
