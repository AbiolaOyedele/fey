import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'

/**
 * GET /api/v1/portal/payments
 * Returns the authenticated portal client's payment requests (excludes cancelled).
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const payments = await portalService.getPortalPayments(db, payload!.contact_id)
    return NextResponse.json({ payments })
  } catch (err) {
    return handleError(err, 'PORTAL_PAYMENTS_GET_FAILED')
  }
}
