import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * GET /api/v1/crm/activity
 *
 * Returns { activity: { [contactId]: lastSeenIso } } — when each of the
 * authenticated owner's clients was last active on their portal. Read via the
 * service role so portal_users RLS doesn't block the owner.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const activity = await portalRepo.listPortalLastSeenByOwner(db, user!.id)
    return NextResponse.json({ activity })
  } catch (err) {
    return handleError(err, 'CRM_ACTIVITY_GET_FAILED')
  }
}
