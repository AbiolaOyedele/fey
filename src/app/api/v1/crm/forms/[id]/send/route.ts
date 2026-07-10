import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'
import { sendEmail } from '@/services/email.service'
import { env } from '@/config/env'
import { EMAIL_FROM, portalUrl } from '@/config/email'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const sendSchema = z.object({ to: z.string().email() })

/**
 * POST /api/v1/crm/forms/[id]/send
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!env.RESEND_API_KEY) return NextResponse.json({ error: { code: 'EMAIL_NOT_CONFIGURED', message: 'Email sending is not configured.' } }, { status: 503 })
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'CRM_FORM_SEND_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'CRM_FORM_SEND_VALIDATION', message: 'Valid email address required.' } }, { status: 400 })

  const db = createUserClient(token!)
  try {
    const form    = await crmService.getFormById(db, id, user!.id)
    const updated = await crmService.updateForm(db, id, user!.id, { status: 'sent' })

    // Build the client-facing portal link on the owner's workspace subdomain —
    // the only URL shape the subdomain proxy rewrites to the real portal page.
    const { data: settingsRow } = await db
      .from('fey_settings')
      .select('workspace_slug')
      .eq('user_id', user!.id)
      .maybeSingle()
    const slug = (settingsRow as { workspace_slug: string | null } | null)?.workspace_slug ?? null
    const link = portalUrl(slug, 'forms')

    await sendEmail({
      from:    EMAIL_FROM.documents,
      to:      [parsed.data.to],
      subject: `Form to complete: ${form.title}`,
      html: `<p>You have a form to fill out: <strong>${form.title}</strong>.</p>
             <p><a href="${link}">Open in your portal</a></p>`,
    })
    return NextResponse.json({ form: updated })
  } catch (err) {
    return handleError(err, 'CRM_FORM_SEND_FAILED')
  }
}
