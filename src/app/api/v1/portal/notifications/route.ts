import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as service from '@/services/portal-notifications.service'

/**
 * The client's own notification feed.
 *
 * Portal users authenticate with a custom JWT rather than Supabase Auth, so
 * there's no auth.uid() for RLS to scope on. requirePortalAuth verifies the
 * token and every query below is scoped by the portal_user_id it carries —
 * never by anything in the request body.
 */

/** GET /api/v1/portal/notifications — the feed plus an unread count. */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    return NextResponse.json(await service.listForClient(db, payload!.portal_user_id))
  } catch (err) {
    return handleError(err, 'PORTAL_NOTIFICATIONS_LIST_FAILED')
  }
}

/**
 * PATCH /api/v1/portal/notifications
 * Body `{ id }` marks one read; an empty body marks the whole feed read.
 */
export async function PATCH(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { id?: string } = {}
  try {
    body = (await req.json()) as { id?: string }
  } catch {
    /* no body — mark all */
  }

  const db = createServiceClient()
  try {
    if (body.id) await service.markRead(db, payload!.portal_user_id, body.id)
    else await service.markAllRead(db, payload!.portal_user_id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'PORTAL_NOTIFICATIONS_READ_FAILED')
  }
}
