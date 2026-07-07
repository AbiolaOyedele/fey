import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { deletePostFile } from '@/services/social.service'

/**
 * DELETE /api/v1/social/posts/:id/files/:fileId
 * Removes the metadata row, then best-effort removes the Cloudinary asset
 * server-side.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const db = createUserClient(token!)
  try {
    await deletePostFile(db, id, fileId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'SOCIAL_POST_FILE_DELETE_FAILED')
  }
}
