import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'
import * as portalReview from '@/services/portal-task-review.service'

/**
 * GET  /api/v1/portal/tasks/[taskId]/reviews — the deliverable's version history.
 * POST /api/v1/portal/tasks/[taskId]/reviews — the client supplies a version.
 *
 * Scope always comes from the verified token. The role is read fresh rather
 * than taken from the token, since a client_admin may have demoted this person
 * to viewer since it was issued.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const { taskId } = await params

  const db = createServiceClient()
  try {
    const versions = await portalReview.listReviews(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      taskId,
    )
    return NextResponse.json({ versions })
  } catch (err) {
    return handleError(err, 'PORTAL_REVIEWS_LIST_FAILED')
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const { taskId } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('REVIEW_VERSION_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createServiceClient()
  try {
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)

    const { version, pruned } = await portalReview.addVersion(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      taskId,
      body,
      { portalUserId: me.id, name: me.name, role: me.role },
    )
    return NextResponse.json({ version, pruned }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_REVIEW_VERSION_FAILED')
  }
}
