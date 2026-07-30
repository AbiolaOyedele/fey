import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest } from '@/lib/image-pipeline-context'
import { getGeneration } from '@/services/image-pipeline/generation.service'

/**
 * GET /api/v1/image-pipeline/generations/:id
 * Status read — the polling fallback when Realtime isn't connected, and how the
 * page re-attaches to a run after a reload.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  try {
    return NextResponse.json({ generation: await getGeneration(db, ctx, id) })
  } catch (err) {
    return handleError(err, 'IP_GENERATION_GET_FAILED')
  }
}
