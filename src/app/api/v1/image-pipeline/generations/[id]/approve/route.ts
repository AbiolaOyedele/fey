import { NextRequest, NextResponse, after } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { approveGeneration } from '@/services/image-pipeline/generation.service'

export const maxDuration = 300

/**
 * POST /api/v1/image-pipeline/generations/:id/approve
 * Gate 2 — the only route to a 2K render. Charges 0.75 and renders in the
 * background; the run must be sitting on an approved 1K preview.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    return NextResponse.json(await approveGeneration(db, ctx, id, (task) => after(task)))
  } catch (err) {
    return handleError(err, 'IP_GENERATION_APPROVE_FAILED')
  }
}
