import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'
import { requireCapability } from '@/services/portal-members.service'
import { notifyOwnerAdmins } from '@/services/notifications.service'

/**
 * POST /api/v1/portal/contracts/[contractId]/sign
 * Signs a contract on behalf of the authenticated portal client.
 *
 * Signing is gated on the can_sign capability. The portal already hides the
 * button from people who don't have it, but that's presentation — without the
 * check here, anyone holding a valid portal token could sign by calling this
 * endpoint directly, which is exactly the sort of thing a contract must not
 * allow.
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
    const signer = await requireCapability(db, payload!.portal_user_id, 'sign')
    await portalService.signPortalContract(db, contractId, payload!.contact_id)
    await notifyOwnerAdmins(db, payload!.owner_id, {
      type: 'contract_signed',
      title: 'Contract signed',
      // Naming the signer matters here — "a client signed" is no use when the
      // question later is which of them had the authority.
      body: `${signer.name} signed a contract.`,
      link: `/clients/${payload!.contact_id}/contracts`,
      entityType: 'contract',
      entityId: contractId,
    })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err, 'PORTAL_CONTRACT_SIGN_FAILED')
  }
}
