import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import { getContactForPortalUser } from '@/repositories/portal.repository'
import { submitFeedback } from '@/services/feedback.service'

/**
 * POST /api/v1/portal/feedback
 * Lets a signed-in portal client send feedback straight to the admin. Portal
 * clients are not Supabase auth users, so this uses the service-role client
 * (bypassing RLS) and stores the row with user_id = null, source = 'portal'.
 * The client's email becomes the notification reply-to.
 * Body: { type: 'bug'|'feature'|'other', message, page_url? }
 */
export async function POST(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
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

  const db = createServiceClient()
  try {
    const contact = await getContactForPortalUser(db, payload!.contact_id, payload!.owner_id)
    const feedback = await submitFeedback(
      db,
      {
        userId: null,
        userEmail: contact?.email ?? null,
        userAgent: req.headers.get('user-agent'),
      },
      // source is forced server-side — never trust the client to set it.
      { ...(body as Record<string, unknown>), source: 'portal' },
    )
    return NextResponse.json({ feedback }, { status: 201 })
  } catch (err) {
    return handleError(err, 'FEEDBACK_CREATE_FAILED')
  }
}
