import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalTasks from '@/services/portal-tasks.service'
import * as portalRepo from '@/repositories/portal.repository'

/** Checklist steps on a client's own task. Scope is enforced in the service. */

const createSchema = z.object({ title: z.string().min(1).max(500) })
const patchSchema  = z.object({
  subtask_id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  done:  z.boolean().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch { return errorResponse('PORTAL_TASK_INVALID', 'That request isn’t valid.', 400) }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return errorResponse('PORTAL_TASK_INVALID', 'Give the step a name.', 400)

  const db = createServiceClient()
  try {
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)
    await portalTasks.addSubtask(
      db, { contactId: payload!.contact_id, ownerId: payload!.owner_id }, { role: me.role }, taskId, parsed.data.title,
    )
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_SUBTASK_CREATE_FAILED')
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch { return errorResponse('PORTAL_TASK_INVALID', 'That request isn’t valid.', 400) }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return errorResponse('PORTAL_TASK_INVALID', 'That change isn’t valid.', 400)
  const { subtask_id, ...patch } = parsed.data

  const db = createServiceClient()
  try {
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)
    await portalTasks.updateSubtask(
      db, { contactId: payload!.contact_id, ownerId: payload!.owner_id }, { role: me.role }, taskId, subtask_id, patch,
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'PORTAL_SUBTASK_UPDATE_FAILED')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  const subtaskId = req.nextUrl.searchParams.get('id')
  if (!subtaskId) return errorResponse('PORTAL_TASK_INVALID', 'No step was specified.', 400)

  const db = createServiceClient()
  try {
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)
    await portalTasks.deleteSubtask(
      db, { contactId: payload!.contact_id, ownerId: payload!.owner_id }, { role: me.role }, taskId, subtaskId,
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'PORTAL_SUBTASK_DELETE_FAILED')
  }
}
