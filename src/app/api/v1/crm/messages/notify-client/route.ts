import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { sendEmail } from '@/services/email.service'
import { EMAIL_FROM } from '@/config/email'
import { env } from '@/config/env'

const bodySchema = z.object({ contact_id: z.string().uuid() })
const DEBOUNCE_MIN = 10

/**
 * POST /api/v1/crm/messages/notify-client
 * Emails a client that they have a new message (clients aren't app users, so
 * email is their notification channel). Debounced ~10 min per client so a burst
 * of messages doesn't spam them. Best-effort — the caller fires and forgets.
 */
export async function POST(req: NextRequest) {
  const { response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let contactId: string
  try { contactId = bodySchema.parse(await req.json()).contact_id } catch {
    return errorResponse('NOTIFY_CLIENT_INVALID', 'Invalid request.', 400)
  }

  try {
    const db = createServiceClient()
    // Ownership: the contact must belong to the caller (or their workspace owner).
    const { data: contact } = await db
      .from('crm_contacts')
      .select('email, name, owner_id, portal_enabled')
      .eq('id', contactId)
      .maybeSingle()
    const c = contact as { email: string | null; name: string; owner_id: string; portal_enabled: boolean } | null
    if (!c?.email || !c.portal_enabled) return NextResponse.json({ ok: true }) // nothing to do

    // Debounce: skip if we emailed this client about a message recently.
    const cutoff = new Date(Date.now() - DEBOUNCE_MIN * 60_000).toISOString()
    const { data: recent } = await db
      .from('email_alert_log')
      .select('id')
      .eq('recipient_email', c.email)
      .eq('alert_type', 'client_message')
      .eq('ref_id', contactId)
      .gte('sent_at', cutoff)
      .maybeSingle()
    if (recent) return NextResponse.json({ ok: true })

    // Portal link from the owner's workspace slug.
    const { data: settings } = await db
      .from('fey_settings')
      .select('workspace_slug, company_name')
      .eq('user_id', c.owner_id)
      .maybeSingle()
    const slug = (settings as { workspace_slug: string | null } | null)?.workspace_slug
    const company = (settings as { company_name: string | null } | null)?.company_name ?? 'your workspace'
    const root = env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency'
    const link = slug ? `https://${slug}.${root}/client-login` : `https://${root}`

    await sendEmail({
      from: EMAIL_FROM.notifications,
      to: [c.email],
      subject: `New message from ${company}`,
      html: `<p>Hi ${c.name.split(' ')[0] || 'there'},</p>
             <p>You have a new message in your client portal.</p>
             <p><a href="${link}">Open your portal</a></p>`,
    })
    await db.from('email_alert_log').insert({ recipient_email: c.email, alert_type: 'client_message', ref_id: contactId })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'NOTIFY_CLIENT_FAILED')
  }
}
