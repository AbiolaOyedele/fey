import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { listTaskHandoffs } from '@/services/work-tasks.service'

/**
 * GET /api/v1/tasks/:id/handoffs
 *
 * Every pass of the baton on this task, newest first — who held it, for how
 * long, and what ruling moved it on. RLS scopes the read to people who can
 * already see the task.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    return NextResponse.json({ handoffs: await listTaskHandoffs(db, id) })
  } catch (err) {
    return handleError(err, 'TASK_HANDOFFS_FAILED')
  }
}
