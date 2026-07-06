import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { updateComment, deleteComment } from '@/services/task-comments.service'

/** PATCH /api/v1/comments/:id  Body: { body } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { body?: unknown }
  try {
    body = (await req.json()) as { body?: unknown }
  } catch {
    return NextResponse.json({ error: { code: 'COMMENT_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const comment = await updateComment(db, id, user!.id, body.body)
    return NextResponse.json({ comment })
  } catch (err) {
    return handleError(err, 'COMMENT_UPDATE_FAILED')
  }
}

/** DELETE /api/v1/comments/:id */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    await deleteComment(db, id, user!.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'COMMENT_DELETE_FAILED')
  }
}
