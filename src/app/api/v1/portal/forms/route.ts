import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'

/**
 * GET /api/v1/portal/forms
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const forms = await portalService.getPortalForms(db, payload!.contact_id)
    return NextResponse.json({ forms })
  } catch (err) {
    return handleError(err, 'PORTAL_FORMS_GET_FAILED')
  }
}
