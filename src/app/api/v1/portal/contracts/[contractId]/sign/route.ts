import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'
import * as portalService from '@/services/portal.service'

/**
 * POST /api/v1/portal/contracts/[contractId]/sign
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const { contractId } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const portalUser = await portalRepo.getPortalUser(db, user!.id)
    if (!portalUser) return NextResponse.json({ error: { code: 'PORTAL_USER_NOT_FOUND', message: 'Portal access not found.' } }, { status: 403 })
    await portalService.signPortalContract(db, contractId, portalUser.contact_id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err, 'PORTAL_CONTRACT_SIGN_FAILED')
  }
}
