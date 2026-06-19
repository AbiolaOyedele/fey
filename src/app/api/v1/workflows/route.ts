import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import { listWorkflows, createWorkflow } from '@/services/workflows.service'

/** GET /api/v1/workflows?workspace_id= */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const { ownerId, workspaceId } = await resolveOwnerContext(db, user!.id, req.nextUrl.searchParams.get('workspace_id'))
    const workflows = await listWorkflows(db, ownerId, workspaceId)
    return NextResponse.json({ workflows })
  } catch (err) {
    return handleError(err, 'WORKFLOWS_LIST_FAILED')
  }
}

/** POST /api/v1/workflows  Body: { name, workspace_id?, stages? } */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: { code: 'WORKFLOW_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const { ownerId, workspaceId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const workflow = await createWorkflow(db, { ownerId, workspaceId }, body)
    return NextResponse.json({ workflow }, { status: 201 })
  } catch (err) {
    return handleError(err, 'WORKFLOW_CREATE_FAILED')
  }
}
