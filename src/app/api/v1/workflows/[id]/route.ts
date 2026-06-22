import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { canManageOwner } from '@/lib/owner-context'
import { renameWorkflow, addStage } from '@/services/workflows.service'

/** Loads a workflow's owner_id and verifies the caller can manage it. */
async function guard(db: ReturnType<typeof createServiceClient>, workflowId: string, userId: string) {
  const { data } = await db.from('workflows').select('owner_id').eq('id', workflowId).maybeSingle()
  const ownerId = (data as { owner_id: string } | null)?.owner_id
  if (!ownerId) return { ok: false as const, status: 404, msg: 'Workflow not found.' }
  if (!(await canManageOwner(db, userId, ownerId))) return { ok: false as const, status: 403, msg: 'You don’t have permission to edit this board.' }
  return { ok: true as const }
}

/** PATCH /api/v1/workflows/:id  Body: { name } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { name?: string }
  try { body = (await req.json()) as { name?: string } } catch {
    return errorResponse('WORKFLOW_INVALID_BODY', 'Invalid request body.', 400)
  }

  const db = createServiceClient()
  try {
    const g = await guard(db, id, user!.id)
    if (!g.ok) return errorResponse('WORKFLOW_FORBIDDEN', g.msg, g.status)
    await renameWorkflow(db, id, body.name ?? '')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'WORKFLOW_UPDATE_FAILED')
  }
}

/** POST /api/v1/workflows/:id (add a stage)  Body: { name, color, sort_order } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { name?: string; color?: string; sort_order?: number }
  try { body = (await req.json()) as { name?: string; color?: string; sort_order?: number } } catch {
    return errorResponse('STAGE_INVALID_BODY', 'Invalid request body.', 400)
  }

  const db = createServiceClient()
  try {
    const g = await guard(db, id, user!.id)
    if (!g.ok) return errorResponse('STAGE_FORBIDDEN', g.msg, g.status)
    const stage = await addStage(db, id, body.name ?? '', body.color ?? '#94A3B8', typeof body.sort_order === 'number' ? body.sort_order : 0)
    return NextResponse.json({ stage }, { status: 201 })
  } catch (err) {
    return handleError(err, 'STAGE_CREATE_FAILED')
  }
}
