import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { listComments, addComment } from '@/services/task-comments.service'

/** GET /api/v1/tasks/:id/comments */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    return NextResponse.json({ comments: await listComments(db, id) })
  } catch (err) {
    return handleError(err, 'COMMENT_LIST_FAILED')
  }
}

/** POST /api/v1/tasks/:id/comments  Body: { body } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const comment = await addComment(db, id, user!.id, body.body)
    return NextResponse.json({ comment }, { status: 201 })
  } catch (err) {
    return handleError(err, 'COMMENT_CREATE_FAILED')
  }
}
