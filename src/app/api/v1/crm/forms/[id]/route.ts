import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const form = await crmService.getFormById(db, id, user!.id)
    return NextResponse.json({ form })
  } catch (err) {
    return handleError(err, 'CRM_FORM_GET_FAILED')
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'CRM_FORM_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const db = createUserClient(token!)
  try {
    const form = await crmService.updateForm(db, id, user!.id, body)
    return NextResponse.json({ form })
  } catch (err) {
    return handleError(err, 'CRM_FORM_UPDATE_FAILED')
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    await crmService.deleteForm(db, id, user!.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'CRM_FORM_DELETE_FAILED')
  }
}
