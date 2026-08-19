import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { subscribeToPush, unsubscribeFromPush } from '@/services/portal-notifications.service'

/**
 * POST   /api/v1/portal/push — register this device for notifications.
 * DELETE /api/v1/portal/push — stop notifications on this device.
 *
 * The portal user comes from the verified token, never the body, so one client
 * can't register a device against another's account.
 */
export async function POST(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PORTAL_PUSH_INVALID_BODY', 'Invalid request body.', 400)
  }

  try {
    await subscribeToPush(
      createServiceClient(),
      { portalUserId: payload!.portal_user_id, ownerId: payload!.owner_id },
      body,
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'PORTAL_PUSH_SUBSCRIBE_FAILED')
  }
}

export async function DELETE(req: NextRequest) {
  const { response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { endpoint?: string }
  try { body = (await req.json()) as { endpoint?: string } } catch {
    return errorResponse('PORTAL_PUSH_INVALID_BODY', 'Invalid request body.', 400)
  }
  if (!body.endpoint) {
    return errorResponse('PORTAL_PUSH_INVALID', 'Nothing to unsubscribe.', 400)
  }

  try {
    await unsubscribeFromPush(createServiceClient(), body.endpoint)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'PORTAL_PUSH_UNSUBSCRIBE_FAILED')
  }
}
