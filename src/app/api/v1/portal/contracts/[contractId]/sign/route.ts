import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'

/**
 * POST /api/v1/portal/contracts/[contractId]/sign
 * Signs a contract on behalf of the authenticated portal client.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const { contractId } = await params
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    await portalService.signPortalContract(db, contractId, payload!.contact_id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err, 'PORTAL_CONTRACT_SIGN_FAILED')
  }
}
