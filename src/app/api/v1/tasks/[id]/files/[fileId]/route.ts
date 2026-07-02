import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { deleteTaskFile } from '@/services/work-tasks.service'

/**
 * DELETE /api/v1/tasks/:id/files/:fileId
 * Removes the metadata row, then best-effort removes the Cloudinary asset
 * server-side (metadata is the source of truth; CDN cleanup never fails the
 * request).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const db = createUserClient(token!)
  try {
    await deleteTaskFile(db, id, fileId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'TASK_FILE_DELETE_FAILED')
  }
}
