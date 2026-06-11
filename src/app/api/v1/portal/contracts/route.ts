import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'

/**
 * GET /api/v1/portal/contracts
 * Returns all sent/signed/declined contracts for the authenticated portal user's contact.
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const contracts = await portalService.getPortalContracts(db, payload!.contact_id)
    return NextResponse.json({ contracts })
  } catch (err) {
    return handleError(err, 'PORTAL_CONTRACTS_GET_FAILED')
  }
}
