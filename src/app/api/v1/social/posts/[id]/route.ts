import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { updatePost, deletePost } from '@/services/social.service'

/** PATCH /api/v1/social/posts/:id — body: UpdatePostPayload */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: { code: 'SOCIAL_POST_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const post = await updatePost(db, id, body)
    return NextResponse.json({ post })
  } catch (err) {
    return handleError(err, 'SOCIAL_POST_UPDATE_FAILED')
  }
}

/** DELETE /api/v1/social/posts/:id — soft delete. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const db = createUserClient(token!)
  try {
    await deletePost(db, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'SOCIAL_POST_DELETE_FAILED')
  }
}
