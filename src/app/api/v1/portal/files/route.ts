import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'
import * as portalService from '@/services/portal.service'

/**
 * GET /api/v1/portal/files
 */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const portalUser = await portalRepo.getPortalUser(db, user!.id)
    if (!portalUser) return NextResponse.json({ error: { code: 'PORTAL_USER_NOT_FOUND', message: 'Portal access not found.' } }, { status: 403 })
    const files = await portalService.getPortalFiles(db, portalUser.contact_id)
    return NextResponse.json({ files })
  } catch (err) {
    return handleError(err, 'PORTAL_FILES_GET_FAILED')
  }
}
