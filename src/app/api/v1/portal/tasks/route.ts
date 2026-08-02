import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalTasks from '@/services/portal-tasks.service'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * GET  /api/v1/portal/tasks — the client's tasks.
 * POST /api/v1/portal/tasks — the client raises one, optionally assigned to
 *                             agency people the owner has made visible to them.
 *
 * Scope always comes from the verified token, never the request body.
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const scope = { contactId: payload!.contact_id, ownerId: payload!.owner_id }
    const [tasks, stages] = await Promise.all([
      portalTasks.listTasks(db, scope),
      portalTasks.listStages(db, scope),
    ])
    return NextResponse.json({ tasks, stages })
  } catch (err) {
    return handleError(err, 'PORTAL_TASKS_GET_FAILED')
  }
}

export async function POST(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PORTAL_TASK_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createServiceClient()
  try {
    // The role is read fresh rather than taken from the token: a client_admin
    // may have demoted this person to viewer since the token was issued.
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)

    const task = await portalTasks.createTask(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      { id: me.id, name: me.name, role: me.role },
      body,
    )
    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_TASK_CREATE_FAILED')
  }
}
