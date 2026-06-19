import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { updateStage, deleteStage } from '@/services/workflows.service'

/** PATCH /api/v1/workflow-stages/:id  Body: { name?, color?, sort_order? } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { name?: string; color?: string; sort_order?: number }
  try {
    body = (await req.json()) as { name?: string; color?: string; sort_order?: number }
  } catch {
    return NextResponse.json({ error: { code: 'STAGE_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    await updateStage(db, id, body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'STAGE_UPDATE_FAILED')
  }
}

/** DELETE /api/v1/workflow-stages/:id */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    await deleteStage(db, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'STAGE_DELETE_FAILED')
  }
}
