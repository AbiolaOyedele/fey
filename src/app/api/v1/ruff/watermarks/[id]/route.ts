import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { deleteWatermark } from '@/services/watermark.service'

/** DELETE /api/v1/ruff/watermarks/:id — soft delete + Cloudinary cleanup. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const db = createUserClient(token!)
  try {
    await deleteWatermark(db, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'RUFF_WATERMARK_DELETE_FAILED')
  }
}
