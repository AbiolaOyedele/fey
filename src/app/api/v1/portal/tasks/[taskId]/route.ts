import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalTasks from '@/services/portal-tasks.service'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * PATCH  /api/v1/portal/tasks/[taskId] — edit a task the client raised.
 * DELETE /api/v1/portal/tasks/[taskId] — withdraw one.
 *
 * Only tasks the client raised can be touched — the service enforces that, not
 * this route. Both read the caller's role fresh from the database rather than
 * trusting the 30-day token, so a demotion takes effect immediately.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PORTAL_TASK_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createServiceClient()
  try {
    // Role is read fresh — a 30-day token must not outlive a demotion.
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)

    const task = await portalTasks.patchTask(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      { id: me.id, name: me.name, role: me.role },
      taskId,
      body,
    )
    return NextResponse.json({ task })
  } catch (err) {
    return handleError(err, 'PORTAL_TASK_UPDATE_FAILED')
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  const db = createServiceClient()
  try {
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)

    await portalTasks.deleteTask(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      { name: me.name, role: me.role },
      taskId,
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'PORTAL_TASK_DELETE_FAILED')
  }
}
