import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/v1/crm/contacts/[id]
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const contact = await crmService.getContactById(db, id, user!.id)
    return NextResponse.json({ contact })
  } catch (err) {
    return handleError(err, 'CRM_CONTACT_GET_FAILED')
  }
}

/**
 * PATCH /api/v1/crm/contacts/[id]
 * Body: any UpdateContactPayload fields
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'CRM_CONTACT_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const db = createUserClient(token!)
  try {
    const contact = await crmService.updateContact(db, id, user!.id, body)
    return NextResponse.json({ contact })
  } catch (err) {
    return handleError(err, 'CRM_CONTACT_UPDATE_FAILED')
  }
}

/**
 * DELETE /api/v1/crm/contacts/[id]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    await crmService.deleteContact(db, id, user!.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'CRM_CONTACT_DELETE_FAILED')
  }
}
