import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { errorResponse, handleError } from '@/lib/api-helpers'

/**
 * GET /api/v1/portal/branding?slug=xxx
 *
 * Public endpoint — returns workspace branding for the client login page.
 * Only exposes presentation data (name, logo, accent color) — no owner identity.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.toLowerCase().trim()
  if (!slug) return errorResponse('PORTAL_SLUG_REQUIRED', 'Workspace slug is required.', 400)

  try {
    const db = createServiceClient()
    const { data } = await db
      .from('fey_settings')
      .select('company_name, logo, accent_color, portal_active')
      .eq('workspace_slug', slug)
      .maybeSingle()

    if (!data) return errorResponse('PORTAL_NOT_FOUND', 'Workspace not found.', 404)
    const row = data as Record<string, unknown>
    if (!row.portal_active) return errorResponse('PORTAL_INACTIVE', 'This portal is not active.', 403)

    return NextResponse.json({
      branding: {
        business_name: (row.company_name as string | null) ?? 'Client Portal',
        logo_url:      (row.logo as string | null) ?? null,
        accent_color:  (row.accent_color as string | null) ?? '#101010',
      },
    })
  } catch (err) {
    return handleError(err, 'PORTAL_BRANDING_FAILED')
  }
}
