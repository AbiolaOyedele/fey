import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError, errorResponse } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'
import * as crmRepo from '@/repositories/crm.repository'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * POST /api/v1/portal/auth/signup
 * Creates a Supabase auth user and a portal_users row.
 * Body: { subdomain, name, email, password, contact_id }
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PORTAL_SIGNUP_INVALID_BODY', 'Invalid request body.', 400)
  }

  try {
    const payload = await portalService.validateSignupPayload(body)

    const adminDb = createServiceClient()

    // 1. Resolve owner from subdomain
    const branding = await portalRepo.getOwnerBySubdomain(adminDb, payload.subdomain)
    if (!branding) return errorResponse('PORTAL_NOT_FOUND', 'Portal not found.', 404)
    if (!branding.portal_active) return errorResponse('PORTAL_INACTIVE', 'This portal is not active.', 403)

    // 2. Verify contact exists and belongs to this owner
    const contact = await portalRepo.getContactById(adminDb, payload.contact_id)
    if (!contact) return errorResponse('CRM_CONTACT_NOT_FOUND', 'Contact not found.', 404)

    // Need to resolve ownerId from branding — look up fey_settings row
    const { data: settingsRow } = await adminDb
      .from('fey_settings')
      .select('user_id, business_email')
      .eq('portal_subdomain', payload.subdomain)
      .maybeSingle()
    if (!settingsRow) return errorResponse('PORTAL_OWNER_NOT_FOUND', 'Portal owner not found.', 404)
    const ownerId    = settingsRow.user_id as string
    const ownerEmail = (settingsRow.business_email as string | null) ?? ''

    if (contact.owner_id !== ownerId) {
      return errorResponse('PORTAL_ACCESS_DENIED', 'Access denied.', 403)
    }
    if (!contact.portal_enabled) {
      return errorResponse('PORTAL_DISABLED', 'The portal is not enabled for this contact.', 403)
    }

    // 3. Create Supabase auth user
    const { data: authData, error: authError } = await adminDb.auth.admin.createUser({
      email:    payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { name: payload.name, role: 'portal_client' },
    })
    if (authError ?? !authData.user) {
      if (authError?.message?.includes('already registered')) {
        return errorResponse('PORTAL_SIGNUP_EMAIL_TAKEN', 'An account with this email already exists.', 409)
      }
      return errorResponse('PORTAL_SIGNUP_AUTH_FAILED', authError?.message ?? 'Account creation failed.', 400)
    }

    const newUserId = authData.user.id

    // 4. Create portal_users row
    await portalRepo.createPortalUser(adminDb, {
      id:         newUserId,
      contact_id: payload.contact_id,
      owner_id:   ownerId,
      name:       payload.name,
      email:      payload.email,
      avatar_url: null,
      created_at: new Date().toISOString(),
    })

    // 5. Create in-app notification for owner
    await crmRepo.createNotification(adminDb, ownerId, payload.contact_id, 'client_signup', `${payload.name} just joined your portal`)

    // 6. Send email to owner if Resend is configured
    try {
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey && ownerEmail) {
        const { Resend } = await import('resend')
        const resend = new Resend(resendKey)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        await resend.emails.send({
          from:    'Fey Workboard <notifications@feyapp.com>',
          to:      [ownerEmail],
          subject: `${payload.name} joined your portal`,
          html: `<p><strong>${payload.name}</strong> (${payload.email}) just signed up to your client portal.</p>
                 ${appUrl ? `<p><a href="${appUrl}/clients/${payload.contact_id}/messages">View their workspace</a></p>` : ''}`,
        })
      }
    } catch {
      // Email failure is non-fatal
    }

    return NextResponse.json({ success: true, userId: newUserId }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_SIGNUP_FAILED')
  }
}
