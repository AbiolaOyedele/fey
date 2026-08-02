import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalTasks from '@/services/portal-tasks.service'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * PATCH /api/v1/portal/tasks/[taskId]
 *
 * Ticks a client's own task off. Only tasks the client raised can be changed —
 * the service enforces that, not this route.
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

    const task = await portalTasks.setTaskDone(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      { id: me.id, role: me.role },
      taskId,
      body,
    )
    return NextResponse.json({ task })
  } catch (err) {
    return handleError(err, 'PORTAL_TASK_UPDATE_FAILED')
  }
}
