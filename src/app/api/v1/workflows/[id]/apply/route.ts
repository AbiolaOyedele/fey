import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { applyWorkflowToProject } from '@/services/workflows.service'

/**
 * POST /api/v1/workflows/:id/apply  Body: { project_id }
 * Points a project at this workflow (the board renders against it).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { project_id?: string }
  try {
    body = (await req.json()) as { project_id?: string }
  } catch {
    return NextResponse.json({ error: { code: 'WORKFLOW_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  if (!body.project_id) {
    return NextResponse.json({ error: { code: 'WORKFLOW_APPLY_NO_PROJECT', message: 'A project is required.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    await applyWorkflowToProject(db, body.project_id, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'WORKFLOW_APPLY_FAILED')
  }
}
