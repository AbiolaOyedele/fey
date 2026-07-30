import { NextRequest, NextResponse, after } from 'next/server'
import { errorResponse, handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { rateLimit } from '@/lib/rate-limit'
import { getActiveGeneration, listGenerations, startGeneration } from '@/services/image-pipeline/generation.service'
import { MAX_GENERATION_STARTS_PER_MINUTE } from '@/types/image-pipeline'

export const maxDuration = 300

/**
 * GET /api/v1/image-pipeline/generations — this user's runs, newest first.
 * With `?active=1`, returns just the run still in progress (if any) so the
 * Generate page can pick up where the user left off.
 */
export async function GET(req: NextRequest) {
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  try {
    if (req.nextUrl.searchParams.get('active') === '1') {
      return NextResponse.json({ generation: await getActiveGeneration(db, ctx.userId) })
    }
    return NextResponse.json({ generations: await listGenerations(db, ctx.userId) })
  } catch (err) {
    return handleError(err, 'IP_GENERATIONS_LIST_FAILED')
  }
}

/**
 * POST /api/v1/image-pipeline/generations
 * Starts a run: charges the 0.25 preview, then writes the prompt and 1K preview
 * in the background so the request returns immediately. The client follows the
 * status transitions over Realtime — and because the work is server-side, it
 * keeps going whether or not the user stays on the page.
 */
export async function POST(req: NextRequest) {
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response

  const limit = rateLimit(`ip:start:${ctx.userId}`, MAX_GENERATION_STARTS_PER_MINUTE, 60_000)
  if (!limit.allowed) {
    const res = errorResponse('IP_RATE_LIMITED', 'You’re starting generations too quickly. Give it a moment.', 429)
    res.headers.set('Retry-After', String(limit.retryAfter))
    return res
  }

  try {
    const result = await startGeneration(db, ctx, body, (task) => after(task))
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return handleError(err, 'IP_GENERATION_START_FAILED')
  }
}
