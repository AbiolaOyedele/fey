import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { listReviews, addVersion } from '@/services/task-review.service'

/**
 * GET  /api/v1/tasks/[id]/reviews — every version of the deliverable, newest first.
 * POST /api/v1/tasks/[id]/reviews — record a new version (metadata; the binary
 *                                   is already in Cloudinary).
 *
 * RLS decides who may see or add: a review row is reachable exactly when its
 * parent task is.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { id } = await params

  const db = createUserClient(token!)
  try {
    const versions = await listReviews(db, id, 'team')
    return NextResponse.json({ versions })
  } catch (err) {
    return handleError(err, 'TASK_REVIEWS_LIST_FAILED')
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('REVIEW_VERSION_INVALID', 'That request isn’t valid.', 400)
  }

  const meta = user!.user_metadata as Record<string, unknown> | undefined
  const name = (meta?.full_name as string | undefined)
    ?? (meta?.name as string | undefined)
    ?? user!.email
    ?? null

  const db = createUserClient(token!)
  try {
    const { version, pruned } = await addVersion(db, id, body, {
      userId: user!.id,
      name,
      type: 'team',
    })
    return NextResponse.json({ version, pruned }, { status: 201 })
  } catch (err) {
    return handleError(err, 'TASK_REVIEW_VERSION_FAILED')
  }
}
