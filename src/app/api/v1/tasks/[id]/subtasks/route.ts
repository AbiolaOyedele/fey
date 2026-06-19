import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { addSubtask } from '@/services/work-tasks.service'

/** POST /api/v1/tasks/:id/subtasks  Body: { title, sort_order? } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { title?: unknown; sort_order?: unknown }
  try {
    body = (await req.json()) as { title?: unknown; sort_order?: unknown }
  } catch {
    return NextResponse.json({ error: { code: 'SUBTASK_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const subtask = await addSubtask(db, id, String(body.title ?? ''), typeof body.sort_order === 'number' ? body.sort_order : 0)
    return NextResponse.json({ subtask }, { status: 201 })
  } catch (err) {
    return handleError(err, 'SUBTASK_CREATE_FAILED')
  }
}
