import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/config/env'
import { updateFeedbackStatus } from '@/repositories/feedback.repository'
import type { FeedbackStatus } from '@/types/feedback'

const VALID: FeedbackStatus[] = ['new', 'triaged', 'done']

/**
 * PATCH /api/v1/admin/feedback/[id]
 * Updates a feedback row's status. Admin-only.
 * Body: { status: 'new' | 'triaged' | 'done' }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  if (!isAdminEmail(user!.email)) {
    return errorResponse('ADMIN_FORBIDDEN', 'You don’t have access to this page.', 403)
  }

  const { id } = await ctx.params
  let body: { status?: string }
  try {
    body = (await req.json()) as { status?: string }
  } catch {
    return errorResponse('ADMIN_FEEDBACK_INVALID_BODY', 'Invalid request body.', 400)
  }
  if (!body.status || !VALID.includes(body.status as FeedbackStatus)) {
    return errorResponse('ADMIN_FEEDBACK_INVALID_STATUS', 'Invalid status value.', 400)
  }

  try {
    const db = createServiceClient()
    await updateFeedbackStatus(db, id, body.status as FeedbackStatus)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'ADMIN_FEEDBACK_UPDATE_FAILED')
  }
}
