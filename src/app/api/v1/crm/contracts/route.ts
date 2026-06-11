import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'

/**
 * GET /api/v1/crm/contracts?contact_id=...
 */
export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (!contactId) return NextResponse.json({ error: { code: 'CRM_CONTRACTS_MISSING_CONTACT', message: 'contact_id is required.' } }, { status: 400 })
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const contracts = await crmService.getContracts(db, contactId, user!.id)
    return NextResponse.json({ contracts })
  } catch (err) {
    return handleError(err, 'CRM_CONTRACTS_GET_FAILED')
  }
}

/**
 * POST /api/v1/crm/contracts
 * Body: { contact_id, title }
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'CRM_CONTRACT_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const db = createUserClient(token!)
  try {
    const contract = await crmService.createContract(db, user!.id, body)
    return NextResponse.json({ contract }, { status: 201 })
  } catch (err) {
    return handleError(err, 'CRM_CONTRACT_CREATE_FAILED')
  }
}
