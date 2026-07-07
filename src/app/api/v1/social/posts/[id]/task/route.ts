import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import { markPostAsTask } from '@/services/social.service'

/**
 * POST /api/v1/social/posts/:id/task — body: { workspace_id? }
 * Promotes a post to a work_task on the main Tasks page. Idempotent.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch { /* body is optional */ }

  const db = createUserClient(token!)
  try {
    const { ownerId, workspaceId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const post = await markPostAsTask(db, { userId: user!.id, ownerId, workspaceId }, id)
    return NextResponse.json({ post })
  } catch (err) {
    return handleError(err, 'SOCIAL_POST_TASK_FAILED')
  }
}
