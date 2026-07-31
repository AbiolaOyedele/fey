import { NextRequest, NextResponse, after } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { retryGeneration } from '@/services/image-pipeline/generation.service'

export const maxDuration = 300

/**
 * POST /api/v1/image-pipeline/generations/:id/retry
 * Re-attempts a failed run from where it broke — reusing the prompt/preview it
 * already produced — and re-charges only the step being retried. The run must be
 * in the 'failed' state.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    return NextResponse.json(await retryGeneration(db, ctx, id, (task) => after(task)))
  } catch (err) {
    return handleError(err, 'IP_GENERATION_RETRY_FAILED')
  }
}
