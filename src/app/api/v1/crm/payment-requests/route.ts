import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'

/**
 * POST /api/v1/crm/payment-requests
 *
 * Creates a payment link for a client and notifies them in their portal.
 *
 * Runs on a USER-scoped client so RLS proves the contact belongs to the caller;
 * the client-facing notification is fired inside the service, which brings its
 * own service-role connection for that one write.
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('CRM_PAYMENT_INVALID', 'That request isn’t valid.', 400)
  }

  try {
    const request = await crmService.createPaymentRequest(createUserClient(token!), user!.id, body)
    return NextResponse.json({ request }, { status: 201 })
  } catch (err) {
    return handleError(err, 'CRM_PAYMENT_CREATE_FAILED')
  }
}
