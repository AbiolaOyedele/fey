import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalTasks from '@/services/portal-tasks.service'

/**
 * GET /api/v1/portal/team
 *
 * The agency people this client may see and assign work to. Empty until the
 * owner grants access from the client's Portal settings — so a fresh portal
 * never exposes the roster by default.
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const members = await portalTasks.listAssignableMembers(db, {
      contactId: payload!.contact_id,
      ownerId:   payload!.owner_id,
    })
    return NextResponse.json({ members })
  } catch (err) {
    return handleError(err, 'PORTAL_TEAM_LIST_FAILED')
  }
}
