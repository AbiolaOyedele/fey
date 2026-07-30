import { NextRequest, NextResponse, after } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { submitPrompt } from '@/services/image-pipeline/generation.service'

export const maxDuration = 300

/**
 * PATCH /api/v1/image-pipeline/generations/:id/prompt — body: { final_prompt }
 *
 * Confirms the prompt at gate 1 (free — covered by the start charge) or edits
 * it after a preview exists (a new preview, so another 0.25). Which one applies
 * is decided from the run's status server-side.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    return NextResponse.json(await submitPrompt(db, ctx, id, body, (task) => after(task)))
  } catch (err) {
    return handleError(err, 'IP_PROMPT_UPDATE_FAILED')
  }
}
