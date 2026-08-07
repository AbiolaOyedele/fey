import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { addComment } from '@/services/task-review.service'

/**
 * POST /api/v1/tasks/[id]/reviews/[reviewId]/comments
 * Body: { body, decision? } — a review note, optionally carrying a ruling
 * ("approved" / "changes_requested") which is applied to the version.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> },
) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { id, reviewId } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('REVIEW_COMMENT_INVALID', 'That request isn’t valid.', 400)
  }

  const meta = user!.user_metadata as Record<string, unknown> | undefined
  const name = (meta?.full_name as string | undefined)
    ?? (meta?.name as string | undefined)
    ?? user!.email
    ?? null

  const db = createUserClient(token!)
  try {
    const comment = await addComment(db, id, reviewId, body, {
      userId: user!.id,
      name,
      type: 'team',
    })
    return NextResponse.json({ comment }, { status: 201 })
  } catch (err) {
    return handleError(err, 'TASK_REVIEW_COMMENT_FAILED')
  }
}
