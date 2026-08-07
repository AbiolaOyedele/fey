import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'
import * as portalReview from '@/services/portal-task-review.service'

/**
 * POST /api/v1/portal/tasks/[taskId]/reviews/[reviewId]/comments
 * The client's review note, optionally carrying a ruling.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string; reviewId: string }> },
) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const { taskId, reviewId } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('REVIEW_COMMENT_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createServiceClient()
  try {
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)

    const comment = await portalReview.addComment(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      taskId,
      reviewId,
      body,
      { portalUserId: me.id, name: me.name, role: me.role },
    )
    return NextResponse.json({ comment }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_REVIEW_COMMENT_FAILED')
  }
}
