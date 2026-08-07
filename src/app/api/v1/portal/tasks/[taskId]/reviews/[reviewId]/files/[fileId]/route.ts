import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'
import * as portalReview from '@/services/portal-task-review.service'

/** DELETE /api/v1/portal/tasks/[taskId]/reviews/[reviewId]/files/[fileId] */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string; reviewId: string; fileId: string }> },
) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const { taskId, reviewId, fileId } = await params

  const db = createServiceClient()
  try {
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)
    await portalReview.deleteVersionFile(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      taskId, reviewId, fileId,
      { portalUserId: me.id, name: me.name, role: me.role },
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'PORTAL_REVIEW_FILE_DELETE_FAILED')
  }
}
