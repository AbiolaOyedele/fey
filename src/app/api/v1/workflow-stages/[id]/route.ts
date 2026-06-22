import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { canManageOwner } from '@/lib/owner-context'
import { updateStage, deleteStage } from '@/services/workflows.service'

/** Resolve the stage's workflow owner and verify the caller can manage it. */
async function guard(db: ReturnType<typeof createServiceClient>, stageId: string, userId: string) {
  const { data } = await db
    .from('workflow_stages')
    .select('workflows ( owner_id )')
    .eq('id', stageId)
    .maybeSingle()
  const wf = (data as { workflows: { owner_id: string } | { owner_id: string }[] | null } | null)?.workflows
  const ownerId = (Array.isArray(wf) ? wf[0] : wf)?.owner_id
  if (!ownerId) return { ok: false as const, status: 404, msg: 'Stage not found.' }
  if (!(await canManageOwner(db, userId, ownerId))) return { ok: false as const, status: 403, msg: 'You don’t have permission to edit this board.' }
  return { ok: true as const }
}

/** PATCH /api/v1/workflow-stages/:id  Body: { name?, color?, sort_order? } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await updateStage(db, id, body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'STAGE_UPDATE_FAILED')
  }
}

/** DELETE /api/v1/workflow-stages/:id */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const g = await guard(db, id, user!.id)
    if (!g.ok) return errorResponse('STAGE_FORBIDDEN', g.msg, g.status)
    await deleteStage(db, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'STAGE_DELETE_FAILED')
  }
}
