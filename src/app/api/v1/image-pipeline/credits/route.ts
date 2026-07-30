import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { createCreditRequest, getCreditsSummary } from '@/services/image-pipeline/credits.service'

/** GET /api/v1/image-pipeline/credits — balance, ledger history, allocation. */
export async function GET(req: NextRequest) {
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  try {
    return NextResponse.json(await getCreditsSummary(db, ctx.userId))
  } catch (err) {
    return handleError(err, 'IP_CREDITS_FAILED')
  }
}

/**
 * POST /api/v1/image-pipeline/credits — body: { amount, note? }
 * Files a top-up request for an admin to approve. Request-only in v1: this
 * grants nothing on its own and there is no payment path.
 */
export async function POST(req: NextRequest) {
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    return NextResponse.json({ request: await createCreditRequest(db, ctx, body) }, { status: 201 })
  } catch (err) {
    return handleError(err, 'IP_CREDIT_REQUEST_FAILED')
  }
}
