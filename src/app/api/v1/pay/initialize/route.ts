import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { appUrl } from '@/config/email'
import { AppError, isAppError } from '@/lib/errors'

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  /** The share_token from crm_payment_requests */
  token: z.string().min(1),
  /** Client-supplied email for Paystack pre-fill */
  email: z.string().email(),
})

interface PaystackInitResponse {
  status: boolean
  message: string
  data?: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/pay/initialize
 * Initializes a Paystack transaction for a direct payment request.
 * Public route — no user auth required, but the request must be pending.
 *
 * Body: { token, email }
 * Returns: { authorizationUrl, reference }
 */
export async function POST(req: NextRequest) {
  if (!env.PAYSTACK_SECRET_KEY) {
    return errorResponse(
      'PAY_NOT_CONFIGURED',
      'Payment collection is not configured on this server.',
      503,
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PAY_INVALID_BODY', 'Invalid request body.', 400)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('PAY_VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request.', 400)
  }

  const { token, email } = parsed.data

  // Fetch the payment request using anon key (public RLS allows pending reads)
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const { data: request, error: fetchErr } = await db
    .from('crm_payment_requests')
    .select('id, amount, currency, description, status')
    .eq('share_token', token)
    .single()

  if (fetchErr ?? !request) {
    return errorResponse('PAY_NOT_FOUND', 'Payment request not found.', 404)
  }

  const row = request as { id: string; amount: number; currency: string; description: string; status: string }

  if (row.status !== 'pending') {
    return errorResponse('PAY_NOT_PENDING', 'This payment request is no longer available.', 409)
  }

  try {
    const amountInSmallestUnit = Math.round(row.amount * 100)
    const callbackUrl = `${appUrl()}/pay/${token}/success`

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInSmallestUnit,
        currency: row.currency.toUpperCase(),
        metadata: {
          payment_request_id: row.id,
          custom_fields: [
            { display_name: 'Payment Request ID', variable_name: 'payment_request_id', value: row.id },
            { display_name: 'Description', variable_name: 'description', value: row.description },
          ],
        },
        callback_url: callbackUrl,
      }),
    })

    const psData = await paystackRes.json() as PaystackInitResponse

    if (!paystackRes.ok || !psData.status || !psData.data) {
      throw new AppError(502, 'Payment initialization failed. Please try again.', 'PAY_PROVIDER_ERROR', psData)
    }

    return NextResponse.json({
      authorizationUrl: psData.data.authorization_url,
      reference: psData.data.reference,
    })
  } catch (err) {
    if (isAppError(err)) {
      return errorResponse(err.code, err.message, err.statusCode)
    }
    console.error('[pay/initialize] Unexpected error:', err)
    return errorResponse('PAY_FAILED', 'Something went wrong. Please try again.', 500)
  }
}
