import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { getPipelineContext, updateOwnSettings } from '@/services/image-pipeline/context.service'

/**
 * GET /api/v1/image-pipeline/context?workspace_id=
 * Everything the corner needs on load: admin flags, resolved tier, preferences,
 * balance, channel availability, and any run left in progress.
 */
export async function GET(req: NextRequest) {
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  try {
    return NextResponse.json(await getPipelineContext(db, ctx))
  } catch (err) {
    return handleError(err, 'IP_CONTEXT_FAILED')
  }
}

/**
 * PATCH /api/v1/image-pipeline/context
 * Updates the caller's own preferences — body: { retention_weeks?, skip_prompt_review? }
 */
export async function PATCH(req: NextRequest) {
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    await updateOwnSettings(db, ctx, body)
    return NextResponse.json(await getPipelineContext(db, ctx))
  } catch (err) {
    return handleError(err, 'IP_SETTINGS_UPDATE_FAILED')
  }
}
