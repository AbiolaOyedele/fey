import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { submitVersion } from '@/services/task-review.service'

/**
 * POST /api/v1/tasks/[id]/reviews/[reviewId]/submit
 * Sends a staged draft for review — the point at which it supersedes the
 * previous version, prunes past the cap, and notifies everyone.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> },
) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { id, reviewId } = await params

  const meta = user!.user_metadata as Record<string, unknown> | undefined
  const name = (meta?.full_name as string | undefined)
    ?? (meta?.name as string | undefined)
    ?? user!.email
    ?? null

  const db = createUserClient(token!)
  try {
    const { version, pruned } = await submitVersion(db, id, reviewId, {
      userId: user!.id,
      name,
      type: 'team',
    })
    return NextResponse.json({ version, pruned })
  } catch (err) {
    return handleError(err, 'TASK_REVIEW_SUBMIT_FAILED')
  }
}
