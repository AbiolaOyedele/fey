import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { notifyOwnerAdmins } from '@/services/notifications.service'
import { captureServerEvent } from '@/lib/posthog-server'

// ── Paystack event shape ───────────────────────────────────────────────────

interface PaystackEvent {
  event: string
  data: {
    status: string
    reference: string
    /** Amount actually charged, in the smallest currency unit (kobo for NGN). */
    amount?: number
    metadata?: {
      invoice_id?: string
      custom_fields?: Array<{
        variable_name: string
        value: string
      }>
    }
  }
}

/** Authoritative invoice total in major units, computed from its own data. */
function computeInvoiceTotal(
  lineItems: Array<{ qty?: number; price?: number }> | null | undefined,
  totals: { additions?: Array<{ value?: number; isPercent?: boolean; sign?: number }> } | null | undefined,
): number {
  const items = lineItems ?? []
  const sub = items.reduce((s, li) => s + Number(li.qty ?? 0) * Number(li.price ?? 0), 0)
  let total = sub
  for (const a of totals?.additions ?? []) {
    const amt = a.isPercent ? (sub * Number(a.value ?? 0)) / 100 : Number(a.value ?? 0)
    total += a.sign === -1 ? -amt : amt
  }
  return Math.round(total * 100) / 100
}

// ── Route handler ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/payments/webhook
 * Receives Paystack webhook events. The signature is verified with HMAC
 * SHA-512 before any processing. On a successful charge, the invoice is
 * marked as 'paid' and linked tasks are marked as paid.
 *
 * Configure this URL in the Paystack dashboard:
 *   https://dashboard.paystack.com/#/settings/developer → Webhooks
 */
export async function POST(req: NextRequest) {
  if (!env.PAYSTACK_SECRET_KEY) {
    // Return 200 anyway so Paystack does not retry indefinitely
    console.warn('[payments/webhook] PAYSTACK_SECRET_KEY not set — webhook ignored')
    return new NextResponse(null, { status: 200 })
  }

  // 1. Read raw body (needed for HMAC verification)
  const rawBody = await req.text()

  // 2. Verify HMAC SHA-512 signature
  const receivedSignature = req.headers.get('x-paystack-signature') ?? ''

  const expectedSignature = createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  const sigBuffer   = Buffer.from(receivedSignature, 'utf8')
  const expectBuffer = Buffer.from(expectedSignature, 'utf8')

  const signatureValid =
    sigBuffer.length === expectBuffer.length &&
    timingSafeEqual(sigBuffer, expectBuffer)

  if (!signatureValid) {
    console.warn('[payments/webhook] Invalid Paystack signature')
    return new NextResponse(null, { status: 401 })
  }

  // 3. Parse event
  let event: PaystackEvent
  try {
    event = JSON.parse(rawBody) as PaystackEvent
  } catch {
    return new NextResponse(null, { status: 400 })
  }

  // 4. Only handle successful charges
  if (event.event !== 'charge.success') {
    return new NextResponse(null, { status: 200 })
  }

  if (event.data.status !== 'success') {
    return new NextResponse(null, { status: 200 })
  }

  // 5. Extract invoice ID from metadata
  const meta = event.data.metadata
  let invoiceId: string | undefined

  if (meta?.invoice_id) {
    invoiceId = meta.invoice_id
  } else if (meta?.custom_fields) {
    const field = meta.custom_fields.find((f) => f.variable_name === 'invoice_id')
    invoiceId = field?.value
  }

  if (!invoiceId) {
    // Payment not linked to an invoice — ignore
    return new NextResponse(null, { status: 200 })
  }

  // 6. Mark invoice as paid using service role (bypasses RLS — webhook has no user session)
  // SUPABASE_SERVICE_ROLE_KEY is expected in environment for server-only operations
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('[payments/webhook] SUPABASE_SERVICE_ROLE_KEY not set')
    return new NextResponse(null, { status: 500 })
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)

  // Fetch invoice to get task_ids and current status
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, status, task_ids, user_id, line_items, totals')
    .eq('id', invoiceId)
    .single()

  if (invoiceError ?? !invoice) {
    console.error('[payments/webhook] Invoice not found:', invoiceId)
    return new NextResponse(null, { status: 200 }) // Return 200 — Paystack retries on non-2xx
  }

  if (invoice.status === 'paid') {
    // Already paid — idempotent, return success
    return new NextResponse(null, { status: 200 })
  }

  // Verify the amount actually charged covers the invoice total. Without this a
  // tampered/underpaid charge (e.g. ₦1) would flip the invoice to "paid".
  const expectedKobo = Math.round(
    computeInvoiceTotal(
      invoice.line_items as Array<{ qty?: number; price?: number }> | null,
      invoice.totals as { additions?: Array<{ value?: number; isPercent?: boolean; sign?: number }> } | null,
    ) * 100,
  )
  const paidKobo = Number(event.data.amount ?? 0)
  // Allow a 1-kobo rounding slack; reject anything that underpays the total.
  if (expectedKobo > 0 && paidKobo + 1 < expectedKobo) {
    console.warn(`[payments/webhook] Underpaid invoice ${invoiceId}: paid ${paidKobo} kobo, expected ${expectedKobo}. Not marking paid.`)
    return new NextResponse(null, { status: 200 }) // 200 so Paystack stops retrying; invoice stays unpaid
  }

  // Update invoice status
  const { error: updateError } = await supabase
    .from('invoices')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  if (updateError) {
    console.error('[payments/webhook] Failed to update invoice:', updateError)
    // Return 500 so Paystack retries
    return new NextResponse(null, { status: 500 })
  }

  // Mark linked tasks as paid (best-effort — do not fail the webhook if this errors)
  try {
    const taskIds = invoice.task_ids as string[] | null
    if (Array.isArray(taskIds) && taskIds.length > 0) {
      await Promise.all(
        taskIds.map((taskId: string) =>
          supabase
            .from('tasks')
            .update({ paid: true })
            .eq('id', taskId)
            .eq('user_id', invoice.user_id as string),
        ),
      )
    }
  } catch (err) {
    console.warn('[payments/webhook] Failed to mark tasks as paid:', err)
  }

  // Notify owner + admins that the invoice was paid (best-effort).
  try {
    await notifyOwnerAdmins(supabase, invoice.user_id as string, {
      type: 'invoice_paid',
      title: 'Invoice paid',
      body: 'A client just paid an invoice.',
      link: `/invoices/${invoiceId}`,
      entityType: 'invoice',
      entityId: invoiceId,
    })
  } catch (err) {
    console.warn('[payments/webhook] Failed to create paid notification:', err)
  }

  await captureServerEvent(invoice.user_id as string, 'invoice_paid', { invoice_id: invoiceId })

  return new NextResponse(null, { status: 200 })
}
