import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import { getTask, updateTask, deleteTask } from '@/services/work-tasks.service'

/** GET /api/v1/tasks/:id */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    return NextResponse.json({ task: await getTask(db, id) })
  } catch (err) {
    return handleError(err, 'TASK_GET_FAILED')
  }
}

/** PATCH /api/v1/tasks/:id */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: { code: 'TASK_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const { ownerId, workspaceId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const task = await updateTask(db, { userId: user!.id, ownerId, workspaceId }, id, body)
    return NextResponse.json({ task })
  } catch (err) {
    return handleError(err, 'TASK_UPDATE_FAILED')
  }
}

/** DELETE /api/v1/tasks/:id (soft delete) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    await deleteTask(db, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'TASK_DELETE_FAILED')
  }
}
