import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * GET /api/v1/portal/auth/session
 * Validates the portal user's session and returns their contact + owner info.
 */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const portalUser = await portalRepo.getPortalUser(db, user!.id)
    if (!portalUser) return NextResponse.json({ error: { code: 'PORTAL_USER_NOT_FOUND', message: 'Portal access not found.' } }, { status: 403 })

    const contact = await portalRepo.getContactForPortalUser(db, portalUser.contact_id, portalUser.owner_id)
    if (!contact) return NextResponse.json({ error: { code: 'PORTAL_ACCESS_DENIED', message: 'Access denied.' } }, { status: 403 })

    const ownerSettings = await portalRepo.getOwnerSettings(db, portalUser.owner_id)
    const branding: import('@/types/crm').PortalOwnerBranding = {
      business_name: (ownerSettings?.company_name as string | null) ?? 'Workboard',
      logo_url:      (ownerSettings?.logo as string | null) ?? null,
      accent_color:  (ownerSettings?.accent_color as string | null) ?? '#ED64A6',
      font:          (ownerSettings?.font_family as string | null) ?? 'NoirPro',
      subdomain:     (ownerSettings?.portal_subdomain as string | null) ?? '',
      portal_active: (ownerSettings?.portal_active as boolean | null) ?? false,
    }

    return NextResponse.json({
      portalUser,
      contact,
      name: portalUser.name,
      branding,
    })
  } catch (err) {
    return handleError(err, 'PORTAL_SESSION_CHECK_FAILED')
  }
}
