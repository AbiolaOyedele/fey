import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import { getPortalTaskAnalytics } from '@/services/portal-task-analytics.service'

/**
 * GET /api/v1/portal/tasks/analytics?range=30d|90d|12m&tz_offset=
 *
 * The client's own delivery numbers, for the portal's Progress panel. 403s
 * unless the owner has switched insights on for this client.
 *
 * Scope always comes from the verified token, never the request — the query
 * string carries no ids at all, and the service refuses to accept one.
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  const sp = req.nextUrl.searchParams
  const rawOffset = Number(sp.get('tz_offset'))

  const db = createServiceClient()
  try {
    const analytics = await getPortalTaskAnalytics(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      {
        range: sp.get('range'),
        tzOffset: Number.isFinite(rawOffset) ? rawOffset : 0,
      },
    )
    return NextResponse.json({ analytics })
  } catch (err) {
    return handleError(err, 'PORTAL_TASK_ANALYTICS_FAILED')
  }
}
