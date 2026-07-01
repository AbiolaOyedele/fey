import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'
import { sendEmail } from '@/services/email.service'
import { env } from '@/config/env'
import { EMAIL_FROM, appUrl } from '@/config/email'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const sendSchema = z.object({ to: z.string().email() })

/**
 * POST /api/v1/crm/contracts/[id]/send
 * Marks contract as 'sent' and emails the client a link.
 * Body: { to: string (email) }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!env.RESEND_API_KEY) return NextResponse.json({ error: { code: 'EMAIL_NOT_CONFIGURED', message: 'Email sending is not configured.' } }, { status: 503 })
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'CRM_CONTRACT_SEND_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'CRM_CONTRACT_SEND_VALIDATION', message: 'Valid email address required.' } }, { status: 400 })

  const db = createUserClient(token!)
  try {
    const contract = await crmService.getContractById(db, id, user!.id)
    const updated  = await crmService.updateContract(db, id, user!.id, { status: 'sent' })

    const portalUrl = appUrl()
    await sendEmail({
      from:    EMAIL_FROM.documents,
      to:      [parsed.data.to],
      subject: `Contract ready to review: ${contract.title}`,
      html: `<p>You have a contract to review: <strong>${contract.title}</strong>.</p>
             <p><a href="${portalUrl}/portal/contracts">View and sign in your portal</a></p>`,
    })
    return NextResponse.json({ contract: updated })
  } catch (err) {
    return handleError(err, 'CRM_CONTRACT_SEND_FAILED')
  }
}
