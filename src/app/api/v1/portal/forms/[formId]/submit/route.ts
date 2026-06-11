import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'
import * as portalService from '@/services/portal.service'

const submitSchema = z.object({
  responses: z.array(z.object({
    field_id: z.string(),
    value:    z.unknown(),
  })),
})

/**
 * POST /api/v1/portal/forms/[formId]/submit
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const { formId } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'PORTAL_FORM_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'PORTAL_FORM_VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }, { status: 400 })
  }
  const db = createUserClient(token!)
  try {
    const portalUser = await portalRepo.getPortalUser(db, user!.id)
    if (!portalUser) return NextResponse.json({ error: { code: 'PORTAL_USER_NOT_FOUND', message: 'Portal access not found.' } }, { status: 403 })
    await portalService.submitPortalForm(db, formId, portalUser.contact_id, parsed.data.responses)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err, 'PORTAL_FORM_SUBMIT_FAILED')
  }
}
