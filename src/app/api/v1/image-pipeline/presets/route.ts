import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { createPreset, listPresets } from '@/services/image-pipeline/preset.service'

/**
 * GET /api/v1/image-pipeline/presets — the presets a user can pick from:
 * built-ins first, then the workspace's own custom presets.
 */
export async function GET(req: NextRequest) {
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  try {
    return NextResponse.json({ presets: await listPresets(db, ctx) })
  } catch (err) {
    return handleError(err, 'IP_PRESETS_LIST_FAILED')
  }
}

/**
 * POST — body: { name, description?, system_prompt }
 * Creates a workspace-authored preset, owned by the acting member.
 */
export async function POST(req: NextRequest) {
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    return NextResponse.json({ preset: await createPreset(db, ctx, body) }, { status: 201 })
  } catch (err) {
    return handleError(err, 'IP_PRESET_CREATE_FAILED')
  }
}
