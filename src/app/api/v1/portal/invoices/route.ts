import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'

/**
 * GET /api/v1/portal/invoices
 * Returns the authenticated portal client's sent invoices (never drafts).
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const invoices = await portalService.getPortalInvoices(db, payload!.contact_id)
    return NextResponse.json({ invoices })
  } catch (err) {
    return handleError(err, 'PORTAL_INVOICES_GET_FAILED')
  }
}
