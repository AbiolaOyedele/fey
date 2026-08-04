import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'
import { requireCapability } from '@/services/portal-members.service'
import { notifyOwnerAdmins } from '@/services/notifications.service'

/**
 * GET /api/v1/portal/messages
 * Returns the thread, plus `unread` — how many of the agency's messages the
 * client hasn't opened.
 *
 * `?peek=1` reads without marking anything read. The dashboard uses it: it only
 * wants the count, and a screen the client never scrolled must not report their
 * messages as read back to the agency.
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const peek = req.nextUrl.searchParams.get('peek') === '1'
  const db = createServiceClient()
  try {
    const { messages, read_receipts, unread } = await portalService.getPortalMessageView(
      db, payload!.contact_id, payload!.owner_id, { markRead: !peek },
    )
    return NextResponse.json({ messages, read_receipts, unread })
  } catch (err) {
    return handleError(err, 'PORTAL_MESSAGES_GET_FAILED')
  }
}

/**
 * POST /api/v1/portal/messages
 * Send a message as the authenticated portal user.
 */
export async function POST(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'PORTAL_MSG_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const db = createServiceClient()
  try {
    // Fetches the portal user AND enforces that they aren't view-only — a
    // viewer with a valid token could otherwise post by calling this directly.
    const portalUser = await requireCapability(db, payload!.portal_user_id, 'write')
    const message = await portalService.sendPortalMessage(db, portalUser, body)
    await notifyOwnerAdmins(db, payload!.owner_id, {
      type: 'client_message',
      title: `New message from ${portalUser.name}`,
      body: message.body?.slice(0, 140) || 'Sent an attachment',
      link: `/clients/${payload!.contact_id}/messages`,
      entityType: 'contact',
      entityId: payload!.contact_id,
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_MESSAGE_SEND_FAILED')
  }
}

/**
 * DELETE /api/v1/portal/messages          — clear the whole thread
 * DELETE /api/v1/portal/messages?id=<uuid> — delete one of the client's own messages
 *
 * Both are permanent, and both are refused for view-only members.
 */
export async function DELETE(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const messageId = req.nextUrl.searchParams.get('id')
  const db = createServiceClient()
  try {
    const portalUser = await requireCapability(db, payload!.portal_user_id, 'write')
    if (messageId) {
      await portalService.deletePortalMessage(db, portalUser, messageId)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json(await portalService.clearPortalMessages(db, portalUser))
  } catch (err) {
    return handleError(err, 'PORTAL_MESSAGE_DELETE_FAILED')
  }
}
