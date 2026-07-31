import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { deletePreset, updatePreset } from '@/services/image-pipeline/preset.service'

/**
 * PATCH /api/v1/image-pipeline/presets/[id] — body: { name, description?, system_prompt }
 * Edits a custom preset. RLS restricts this to the creator or a workspace admin.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    return NextResponse.json({ preset: await updatePreset(db, ctx, id, body) })
  } catch (err) {
    return handleError(err, 'IP_PRESET_UPDATE_FAILED')
  }
}

/** DELETE /api/v1/image-pipeline/presets/[id] — removes a custom preset (creator/admin). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  try {
    await deletePreset(db, ctx, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'IP_PRESET_DELETE_FAILED')
  }
}
