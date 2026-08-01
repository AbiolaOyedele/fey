import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as service from '@/services/portal-notifications.service'

/**
 * The client's own notification preferences — which categories they want.
 * Scoped entirely by the verified portal token; a client can only ever read or
 * change their own row.
 */

/** GET /api/v1/portal/notifications/prefs */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    return NextResponse.json({ prefs: await service.getPrefs(db, payload!.portal_user_id) })
  } catch (err) {
    return handleError(err, 'PORTAL_NOTIF_PREFS_GET_FAILED')
  }
}

/** PATCH /api/v1/portal/notifications/prefs — partial update of the flags. */
export async function PATCH(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'PORTAL_NOTIF_PREFS_INVALID', message: 'That request isn’t valid.' } },
      { status: 400 },
    )
  }

  const db = createServiceClient()
  try {
    const prefs = await service.updatePrefs(
      db,
      { portal_user_id: payload!.portal_user_id, owner_id: payload!.owner_id },
      body,
    )
    return NextResponse.json({ prefs })
  } catch (err) {
    return handleError(err, 'PORTAL_NOTIF_PREFS_UPDATE_FAILED')
  }
}
