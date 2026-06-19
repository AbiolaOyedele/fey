import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { renameWorkflow, addStage } from '@/services/workflows.service'

/** PATCH /api/v1/workflows/:id  Body: { name } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: { name?: string }
  try {
    body = (await req.json()) as { name?: string }
  } catch {
    return NextResponse.json({ error: { code: 'WORKFLOW_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    await renameWorkflow(db, id, body.name ?? '')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'WORKFLOW_UPDATE_FAILED')
  }
}

/** POST /api/v1/workflows/:id (add a stage)  Body: { name, color, sort_order } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const stage = await addStage(db, id, body.name ?? '', body.color ?? '#94A3B8', typeof body.sort_order === 'number' ? body.sort_order : 0)
    return NextResponse.json({ stage }, { status: 201 })
  } catch (err) {
    return handleError(err, 'STAGE_CREATE_FAILED')
  }
}
