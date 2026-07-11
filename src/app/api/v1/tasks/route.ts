import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { resolveOwnerContext, isWorkspaceAdmin } from '@/lib/owner-context'
import { listTasks, createTask } from '@/services/work-tasks.service'
import type { TaskScope } from '@/types/work-tasks'

/**
 * GET /api/v1/tasks?scope=&project_id=&contact_id=&done=&workspace_id=
 * Lists tasks the caller can see (RLS-enforced). scope: all|personal|project|contact.
 */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const sp = req.nextUrl.searchParams
  const scope = (sp.get('scope') ?? 'all') as TaskScope
  const doneParam = sp.get('done')
  const done = doneParam === null ? undefined : doneParam === 'true'

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, sp.get('workspace_id'))
    const isAdmin = await isWorkspaceAdmin(db, user!.id, ownerId)
    const tasks = await listTasks(db, ownerId, {
      scope,
      projectId: sp.get('project_id'),
      contactId: sp.get('contact_id'),
      ...(done !== undefined ? { done } : {}),
      viewer: { id: user!.id, isAdmin },
    })
    return NextResponse.json({ tasks })
  } catch (err) {
    return handleError(err, 'TASKS_LIST_FAILED')
  }
}

/**
 * POST /api/v1/tasks
 * Body: { title, workspace_id?, project_id?, contact_id?, priority?, due_date?, ... }
 */
export async function POST(req: NextRequest) {
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
    const task = await createTask(db, { userId: user!.id, ownerId, workspaceId }, body)
    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    return handleError(err, 'TASK_CREATE_FAILED')
  }
}
