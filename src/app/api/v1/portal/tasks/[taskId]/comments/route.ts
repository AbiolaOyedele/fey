import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalTasks from '@/services/portal-tasks.service'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * GET  /api/v1/portal/tasks/<id>/comments — the whole thread, both sides of it.
 * POST /api/v1/portal/tasks/<id>/comments — the client says something.
 *
 * Scope always comes from the verified token. A client may comment on any task
 * belonging to them, not only ones they raised — most of what a client would
 * want to say is about work the agency is doing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const { taskId } = await params

  try {
    const scope = { contactId: payload!.contact_id, ownerId: payload!.owner_id }
    const comments = await portalTasks.listComments(createServiceClient(), scope, taskId)
    return NextResponse.json({ comments })
  } catch (err) {
    return handleError(err, 'PORTAL_COMMENTS_GET_FAILED')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const { taskId } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PORTAL_COMMENT_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createServiceClient()
  try {
    // Read the role fresh rather than trusting the token: a client_admin may
    // have demoted this person to viewer since it was issued.
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)

    const scope = { contactId: payload!.contact_id, ownerId: payload!.owner_id }
    const comment = await portalTasks.addComment(db, scope, me, taskId, body)
    return NextResponse.json({ comment }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_COMMENT_CREATE_FAILED')
  }
}
