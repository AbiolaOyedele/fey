import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'
import * as portalService from '@/services/portal.service'

/**
 * GET /api/v1/portal/messages
 * Returns all messages for the authenticated portal user's contact.
 */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const portalUser = await portalRepo.getPortalUser(db, user!.id)
    if (!portalUser) return NextResponse.json({ error: { code: 'PORTAL_USER_NOT_FOUND', message: 'Portal access not found.' } }, { status: 403 })
    const messages = await portalService.getPortalMessages(db, portalUser.contact_id)
    return NextResponse.json({ messages })
  } catch (err) {
    return handleError(err, 'PORTAL_MESSAGES_GET_FAILED')
  }
}

/**
 * POST /api/v1/portal/messages
 * Send a message as the authenticated portal user.
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'PORTAL_MSG_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const db = createUserClient(token!)
  try {
    const portalUser = await portalRepo.getPortalUser(db, user!.id)
    if (!portalUser) return NextResponse.json({ error: { code: 'PORTAL_USER_NOT_FOUND', message: 'Portal access not found.' } }, { status: 403 })
    const message = await portalService.sendPortalMessage(db, portalUser, body)
    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_MESSAGE_SEND_FAILED')
  }
}
