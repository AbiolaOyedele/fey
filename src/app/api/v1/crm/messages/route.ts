import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'

/**
 * GET /api/v1/crm/messages?contact_id=...
 */
export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (!contactId) return NextResponse.json({ error: { code: 'CRM_MESSAGES_MISSING_CONTACT', message: 'contact_id is required.' } }, { status: 400 })
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const messages = await crmService.getMessages(db, contactId, user!.id)
    await crmService.readMessages(db, contactId, user!.id)
    return NextResponse.json({ messages })
  } catch (err) {
    return handleError(err, 'CRM_MESSAGES_GET_FAILED')
  }
}

/**
 * POST /api/v1/crm/messages
 * Body: { contact_id, body, body_html?, attachments? }
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'CRM_MESSAGE_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const db = createUserClient(token!)
  try {
    const message = await crmService.sendMessage(db, user!.id, user!.id, body)
    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    return handleError(err, 'CRM_MESSAGE_SEND_FAILED')
  }
}
