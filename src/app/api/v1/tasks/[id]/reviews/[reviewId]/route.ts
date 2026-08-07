import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { deleteVersion } from '@/services/task-review.service'

/**
 * DELETE /api/v1/tasks/[id]/reviews/[reviewId]
 * Removes a version. Allowed for a draft, or for a submitted version that a
 * newer one has already replaced — the service enforces that.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> },
) {
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { id, reviewId } = await params

  const db = createUserClient(token!)
  try {
    await deleteVersion(db, id, reviewId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'TASK_REVIEW_DELETE_FAILED')
  }
}
