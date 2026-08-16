import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import { ruleOnTask } from '@/services/work-tasks.service'

/**
 * POST /api/v1/tasks/:id/approval
 * Body: { decision: 'approved' | 'changes_requested', note?: string }
 *
 * Rules on a task sitting in a stage that requires sign-off. Approving advances
 * it; requesting changes sends it back to where it came from and returns
 * responsibility to whoever handed it over. Who may rule is checked in the
 * service against the stage's approver.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return errorResponse('TASK_RULING_INVALID_BODY', 'Invalid request body.', 400)
  }

  const db = createUserClient(token!)
  try {
    const { ownerId, workspaceId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const task = await ruleOnTask(db, { userId: user!.id, ownerId, workspaceId }, id, body)
    return NextResponse.json({ task })
  } catch (err) {
    return handleError(err, 'TASK_RULING_FAILED')
  }
}
