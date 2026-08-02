import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalTasks from '@/services/portal-tasks.service'
import * as portalRepo from '@/repositories/portal.repository'

/** Attachments on a client's own task. Binaries live in Cloudinary; this is metadata. */

const addSchema = z.object({
  file_name: z.string().min(1).max(500),
  file_url:  z.string().url(),
  public_id: z.string().min(1).max(500),
  file_size: z.number().int().nonnegative().nullish(),
  file_type: z.string().max(120).nullish(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch { return errorResponse('PORTAL_TASK_INVALID', 'That request isn’t valid.', 400) }
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return errorResponse('PORTAL_TASK_INVALID', 'That file isn’t valid.', 400)

  const db = createServiceClient()
  try {
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)
    await portalTasks.addFile(
      db,
      { contactId: payload!.contact_id, ownerId: payload!.owner_id },
      { role: me.role, name: me.name },
      taskId,
      {
        file_name: parsed.data.file_name,
        file_url:  parsed.data.file_url,
        public_id: parsed.data.public_id,
        file_size: parsed.data.file_size ?? null,
        file_type: parsed.data.file_type ?? null,
      },
    )
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_TASK_FILE_ADD_FAILED')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  const fileId = req.nextUrl.searchParams.get('id')
  if (!fileId) return errorResponse('PORTAL_TASK_INVALID', 'No file was specified.', 400)

  const db = createServiceClient()
  try {
    const me = await portalRepo.getPortalUser(db, payload!.portal_user_id)
    if (!me) return errorResponse('PORTAL_USER_NOT_FOUND', 'Portal access not found.', 403)
    await portalTasks.removeFile(
      db, { contactId: payload!.contact_id, ownerId: payload!.owner_id }, { role: me.role }, taskId, fileId,
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'PORTAL_TASK_FILE_REMOVE_FAILED')
  }
}
