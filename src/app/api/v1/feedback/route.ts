import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { submitFeedback } from '@/services/feedback.service'

/**
 * POST /api/v1/feedback
 * Stores a feedback / feature-request submission for the authenticated owner
 * and best-effort emails the admin allowlist.
 * Body: { type: 'bug'|'feature'|'other', message, page_url?, workspace_id? }
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'FEEDBACK_INVALID_BODY', message: 'Invalid request body.' } },
      { status: 400 },
    )
  }

  const db = createUserClient(token!)
  try {
    const feedback = await submitFeedback(
      db,
      {
        userId: user!.id,
        userEmail: user!.email ?? null,
        userAgent: req.headers.get('user-agent'),
      },
      body,
    )
    return NextResponse.json({ feedback }, { status: 201 })
  } catch (err) {
    return handleError(err, 'FEEDBACK_CREATE_FAILED')
  }
}
