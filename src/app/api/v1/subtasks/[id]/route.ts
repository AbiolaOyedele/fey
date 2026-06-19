import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { updateSubtask, deleteSubtask } from '@/services/work-tasks.service'

/** PATCH /api/v1/subtasks/:id  Body: { title?, done?, sort_order? } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { title?: string; done?: boolean; sort_order?: number }
  try {
    body = (await req.json()) as { title?: string; done?: boolean; sort_order?: number }
  } catch {
    return NextResponse.json({ error: { code: 'SUBTASK_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    await updateSubtask(db, id, body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'SUBTASK_UPDATE_FAILED')
  }
}

/** DELETE /api/v1/subtasks/:id */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    await deleteSubtask(db, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'SUBTASK_DELETE_FAILED')
  }
}
