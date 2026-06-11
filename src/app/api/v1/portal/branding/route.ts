import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { errorResponse, handleError } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * GET /api/v1/portal/branding?slug=xxx
 *
 * Public endpoint — returns workspace branding for the client join/login pages.
 * Exposes only presentation data (name, owner name, logo, accent color).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.toLowerCase().trim()
  if (!slug) return errorResponse('PORTAL_SLUG_REQUIRED', 'Workspace slug is required.', 400)

  try {
    const db       = createServiceClient()
    const branding = await portalRepo.getOwnerByWorkspaceSlug(db, slug)

    if (!branding) return errorResponse('PORTAL_NOT_FOUND', 'Workspace not found.', 404)

    return NextResponse.json(branding)
  } catch (err) {
    return handleError(err, 'PORTAL_BRANDING_FAILED')
  }
}
