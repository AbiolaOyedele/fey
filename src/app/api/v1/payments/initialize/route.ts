import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { AppError, isAppError } from '@/lib/errors'

// ── Request validation ─────────────────────────────────────────────────────

const initSchema = z.object({
  invoiceId: z.string().uuid(),
  /**
   * email is required by Paystack to pre-fill the payment form.
   * We accept it from the client (public invoice page knows the bill_to email)
   * rather than fetching it server-side so this route stays lean.
   */
  email: z.string().email(),
  /** Amount in the invoice's currency (e.g. NGN). */
  amount: z.number().positive(),
  currency: z.string().length(3).default('NGN'),
})

// ── Paystack response shape ────────────────────────────────────────────────

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

// ── Route handler ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/payments/initialize
 * Initializes a Paystack transaction for a public invoice.
 * Called from the public /invoice/[token] page — no user auth required,
 * but the invoice must exist and have share_enabled = true.
 *
 * Body: { invoiceId, email, amount, currency }
 * Returns: { authorizationUrl: string, reference: string }
 */
export async function POST(req: NextRequest) {
  if (!env.PAYSTACK_SECRET_KEY) {
    return errorResponse(
      'PAYMENT_INIT_NOT_CONFIGURED',
      'Payment collection is not configured.',
      503,
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('PAYMENT_INIT_INVALID_REQUEST', 'Invalid request body.', 400)
  }

  const parsed = initSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(
      'PAYMENT_INIT_VALIDATION_ERROR',
      firstIssue?.message ?? 'Invalid request.',
      400,
    )
  }

  const { invoiceId, email, amount, currency } = parsed.data

  // Verify the invoice is public (share_enabled = true) using the service-role
  // client so we don't need auth. This prevents initializing payments for
  // private invoices by guessing UUIDs.
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, status, share_enabled, currency')
    .eq('id', invoiceId)
    .eq('share_enabled', true)
    .single()

  if (invoiceError ?? !invoice) {
    return errorResponse('PAYMENT_INIT_INVOICE_NOT_FOUND', 'Invoice not found.', 404)
  }

  if (invoice.status === 'paid') {
    return errorResponse('PAYMENT_INIT_ALREADY_PAID', 'This invoice has already been paid.', 409)
  }

  try {
    // Paystack expects amount in the smallest currency unit (kobo for NGN)
    // NGN has 2 decimal places, so multiply by 100.
    const amountInKobo = Math.round(amount * 100)

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://feyapp.com'}/invoice/payment-success`

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        currency: currency.toUpperCase(),
        // Embed invoiceId in metadata so the webhook can identify the invoice
        metadata: {
          invoice_id: invoiceId,
          custom_fields: [
            { display_name: 'Invoice ID', variable_name: 'invoice_id', value: invoiceId },
          ],
        },
        callback_url: callbackUrl,
      }),
    })

    const psData = await paystackRes.json() as PaystackInitResponse

    if (!paystackRes.ok || !psData.status || !psData.data) {
      throw new AppError(502, 'Payment initialization failed. Please try again.', 'PAYMENT_INIT_PROVIDER_ERROR', psData)
    }

    return NextResponse.json({
      authorizationUrl: psData.data.authorization_url,
      reference: psData.data.reference,
    })
  } catch (err) {
    if (isAppError(err)) {
      return errorResponse(err.code, err.message, err.statusCode)
    }
    console.error('[payments/initialize] Unexpected error:', err)
    return errorResponse('PAYMENT_INIT_FAILED', 'Something went wrong. Please try again.', 500)
  }
}
