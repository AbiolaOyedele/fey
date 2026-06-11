import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { AppError, isAppError } from '@/lib/errors'

// ── Request validation ─────────────────────────────────────────────────────

const sendInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(998),
  body: z.string().min(1).max(10_000),
})

// ── Error response shape ───────────────────────────────────────────────────

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

// ── Route handler ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/invoices/send
 * Sends an invoice to a recipient email via Resend and marks the invoice
 * status as 'sent'. Requires the caller to be authenticated — the invoice
 * must belong to the authenticated user.
 *
 * Body: { invoiceId, to, subject, body }
 * Returns: { success: true }
 */
export async function POST(req: NextRequest) {
  // 1. Check Resend key is configured
  if (!env.RESEND_API_KEY) {
    return errorResponse(
      'EMAIL_SEND_NOT_CONFIGURED',
      'Email sending is not configured. Please add your Resend API key.',
      503,
    )
  }

  // 2. Parse and validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('EMAIL_SEND_INVALID_REQUEST', 'Invalid request body.', 400)
  }

  const parsed = sendInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(
      'EMAIL_SEND_VALIDATION_ERROR',
      firstIssue?.message ?? 'Invalid request.',
      400,
    )
  }

  const { invoiceId, to, subject, body: emailBody } = parsed.data

  // 3. Verify caller is authenticated via Supabase Auth (Bearer token in header)
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return errorResponse('AUTH_SEND_UNAUTHORIZED', 'Authentication required.', 401)
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError ?? !user) {
    return errorResponse('AUTH_SEND_INVALID_TOKEN', 'Invalid or expired session.', 401)
  }

  // 4. Verify the invoice belongs to this user (ownership check)
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, invoice_number, from_details, share_token, share_enabled, status')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (invoiceError ?? !invoice) {
    return errorResponse('INVOICE_SEND_NOT_FOUND', 'Invoice not found.', 404)
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY)

    // 5. Get sender name from invoice's from_details (fallback to "Fey")
    const fromDetails = invoice.from_details as Record<string, unknown> | null
    const senderName = (fromDetails?.name as string | undefined) || 'Fey'

    // Build the share link if enabled
    const shareLink =
      (invoice.share_enabled as boolean) && (invoice.share_token as string | null)
        ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://feyapp.com'}/invoice/${invoice.share_token as string}`
        : null

    // 6. Send via Resend
    const { error: sendError } = await resend.emails.send({
      from: `${senderName} via Fey <invoices@feyapp.com>`,
      to: [to],
      subject,
      text: emailBody + (shareLink ? `\n\nView invoice online: ${shareLink}` : ''),
      html: buildEmailHtml({
        body: emailBody,
        shareLink,
        invoiceNumber: (invoice.invoice_number as string) || '',
      }),
    })

    if (sendError) {
      throw new AppError(502, 'Failed to send email. Please try again.', 'EMAIL_SEND_PROVIDER_ERROR', sendError)
    }

    // 7. Update invoice status to 'sent' (only if currently 'draft')
    if (invoice.status === 'draft') {
      await supabase
        .from('invoices')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (isAppError(err)) {
      return errorResponse(err.code, err.message, err.statusCode)
    }
    console.error('[invoices/send] Unexpected error:', err)
    return errorResponse('EMAIL_SEND_FAILED', 'Something went wrong. Please try again.', 500)
  }
}

// ── Email HTML builder ─────────────────────────────────────────────────────

interface EmailHtmlOptions {
  body: string
  shareLink: string | null
  invoiceNumber: string
}

function buildEmailHtml({ body, shareLink, invoiceNumber }: EmailHtmlOptions): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  const linkSection = shareLink
    ? `
      <div style="margin-top:24px;text-align:center;">
        <a href="${shareLink}" style="
          display:inline-block;padding:12px 28px;background:#1a1a1a;color:#fff;
          text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;
        ">View Invoice${invoiceNumber ? ` #${invoiceNumber}` : ''}</a>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr>
          <td style="padding:32px 40px;border-bottom:1px solid #f0f0f0;">
            <span style="font-size:18px;font-weight:700;color:#1a1a1a;">Fey</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;color:#333;font-size:15px;line-height:1.7;">
            ${escaped}
            ${linkSection}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f0f0f0;font-size:12px;color:#999;text-align:center;">
            Sent via <a href="https://feyapp.com" style="color:#999;">Fey</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
