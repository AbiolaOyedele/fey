import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { deleteVersionFile } from '@/services/task-review.service'

/**
 * DELETE /api/v1/tasks/[id]/reviews/[reviewId]/files/[fileId]
 * Drops one file from a draft before it's sent. Rejected once the version has
 * been submitted — its contents are what people reviewed.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string; fileId: string }> },
) {
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { id, reviewId, fileId } = await params

  const db = createUserClient(token!)
  try {
    await deleteVersionFile(db, id, reviewId, fileId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'TASK_REVIEW_FILE_DELETE_FAILED')
  }
}
