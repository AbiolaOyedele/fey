import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'

/**
 * GET /api/v1/crm/contacts
 * Returns all contacts owned by the authenticated user.
 */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const contacts = await crmService.getContacts(db, user!.id)
    return NextResponse.json({ contacts })
  } catch (err) {
    return handleError(err, 'CRM_CONTACTS_GET_FAILED')
  }
}

/**
 * POST /api/v1/crm/contacts
 * Creates a new contact for the authenticated user.
 * Body: { name, email?, phone?, company?, status? }
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'CRM_CONTACT_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const db = createUserClient(token!)
  try {
    const contact = await crmService.createContact(db, user!.id, body)
    return NextResponse.json({ contact }, { status: 201 })
  } catch (err) {
    return handleError(err, 'CRM_CONTACT_CREATE_FAILED')
  }
}
