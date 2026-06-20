import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'
import { notifyOwnerAdmins } from '@/services/notifications.service'

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
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'PORTAL_FORM_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'PORTAL_FORM_VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }, { status: 400 })
  }
  const db = createServiceClient()
  try {
    await portalService.submitPortalForm(db, formId, payload!.contact_id, parsed.data.responses)
    await notifyOwnerAdmins(db, payload!.owner_id, {
      type: 'form_submitted',
      title: 'Form submitted',
      body: 'A client completed one of your forms.',
      link: `/clients/${payload!.contact_id}/forms`,
      entityType: 'form',
      entityId: formId,
    })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err, 'PORTAL_FORM_SUBMIT_FAILED')
  }
}
