import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { setAssignees } from '@/services/work-tasks.service'

/**
 * PUT /api/v1/tasks/:id/assignees
 * Body: { user_ids: string[] } — replaces the full assignee set.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { user_ids?: unknown }
  try {
    body = (await req.json()) as { user_ids?: unknown }
  } catch {
    return NextResponse.json({ error: { code: 'TASK_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const ids = Array.isArray(body.user_ids) ? body.user_ids.filter((u): u is string => typeof u === 'string') : []

  const db = createUserClient(token!)
  try {
    const task = await setAssignees(db, id, ids, user!.id)
    return NextResponse.json({ task })
  } catch (err) {
    return handleError(err, 'TASK_ASSIGNEES_FAILED')
  }
}
