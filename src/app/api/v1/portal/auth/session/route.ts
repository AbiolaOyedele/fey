import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'
import { resolveWorkspaceName } from '@/utils/workspace'
import type { PortalOwnerBranding } from '@/types/crm'

/**
 * GET /api/v1/portal/auth/session
 *
 * Validates the portal client's custom JWT and returns their session data.
 * Uses the service role client — no Supabase Auth session required.
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  const db = createServiceClient()
  try {
    const portalUser = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!portalUser) {
      return NextResponse.json({ error: { code: 'PORTAL_USER_NOT_FOUND', message: 'Portal access not found.' } }, { status: 403 })
    }

    const contact = await portalRepo.getContactForPortalUser(db, portalUser.contact_id, portalUser.owner_id)
    if (!contact) {
      return NextResponse.json({ error: { code: 'PORTAL_ACCESS_DENIED', message: 'Access denied.' } }, { status: 403 })
    }
    // Archived clients lose portal access (data is preserved, just hidden).
    if ((contact as { archived_at?: string | null }).archived_at) {
      return NextResponse.json({ error: { code: 'PORTAL_ACCESS_DENIED', message: 'Access denied.' } }, { status: 403 })
    }

    // Record portal activity (best-effort — dormant until last_seen_at exists)
    void portalRepo.touchPortalUserLastSeen(db, portalUser.id)

    const ownerSettings = await portalRepo.getOwnerSettings(db, portalUser.owner_id)
    const branding: PortalOwnerBranding = {
      business_name: resolveWorkspaceName(
        ownerSettings?.company_name as string | null,
        ownerSettings?.workspace_slug as string | null,
      ),
      owner_name:    (ownerSettings?.username as string | null) ?? '',
      logo_url:      (ownerSettings?.logo as string | null) ?? null,
      accent_color:  (ownerSettings?.accent_color as string | null) ?? '#ED64A6',
      font:          (ownerSettings?.font_family as string | null) ?? 'NoirPro',
      subdomain:     (ownerSettings?.workspace_slug as string | null) ?? '',
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
