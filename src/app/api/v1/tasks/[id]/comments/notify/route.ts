import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient, createServiceClient } from '@/lib/supabase-server'
import { requireAuth, errorResponse } from '@/lib/api-helpers'
import { notifyCommentParticipants } from '@/services/task-comments.service'

const bodySchema = z.object({
  /** Users already @mentioned in the comment — excluded so they aren't notified twice. */
  excludeUserIds: z.array(z.string().uuid()).max(50).optional(),
})

/**
 * POST /api/v1/tasks/:id/comments/notify
 * Fire-and-forget: notifies a task's assignees + creator that a new comment
 * was posted. Called client-side right after a comment is inserted (mirrors
 * the /api/v1/mentions pattern). Body: { excludeUserIds? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let raw: unknown = {}
  try {
    raw = await req.json()
  } catch {
    // An empty body is fine — excludeUserIds is optional.
  }
  const parsed = bodySchema.safeParse(raw ?? {})
  if (!parsed.success) return errorResponse('COMMENT_NOTIFY_INVALID', 'Invalid request body.', 400)

  const db = createUserClient(token!)

  // Resolve the actor's display name (best-effort) from their workspace membership.
  let actorName: string | null = null
  const { data: member } = await db
    .from('workspace_members')
    .select('name, email')
    .eq('user_id', user!.id)
    .limit(1)
    .maybeSingle()
  if (member) {
    const m = member as { name: string | null; email: string | null }
    actorName = m.name ?? (m.email ? m.email.split('@')[0] : null)
  }

  await notifyCommentParticipants({
    userDb: db,
    serviceDb: createServiceClient(),
    taskId: id,
    actorId: user!.id,
    actorName,
    excludeUserIds: parsed.data.excludeUserIds ?? [],
  })

  return NextResponse.json({ ok: true })
}
