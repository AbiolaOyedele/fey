import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { rejectGeneration } from '@/services/image-pipeline/generation.service'

/**
 * POST /api/v1/image-pipeline/generations/:id/reject
 * Rejects the preview. No further charge — the 0.25 already spent stands. The
 * image is kept until the run's retention deadline like any other.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    return NextResponse.json({ generation: await rejectGeneration(db, ctx, id) })
  } catch (err) {
    return handleError(err, 'IP_GENERATION_REJECT_FAILED')
  }
}
