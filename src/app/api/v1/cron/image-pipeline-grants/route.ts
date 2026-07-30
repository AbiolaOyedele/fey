import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError } from '@/lib/api-helpers'
import { env } from '@/config/env'
import { runCreditGrants, runFlowJanitor } from '@/services/image-pipeline/maintenance.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/v1/cron/image-pipeline-grants — daily.
 *
 * Grants due credit allocations and re-queues stalled Flow jobs. The spec asks
 * for hourly, but Vercel's Hobby plan caps crons at one run a day; weekly and
 * monthly allocations don't need finer granularity, and runCreditGrants skips
 * past any windows a late run missed. Move it back to `0 * * * *` on Pro.
 *
 * SAFETY: disabled until CRON_SECRET is set, and every request must present it
 * (Vercel Cron injects `Authorization: Bearer <CRON_SECRET>`), so no credits
 * are ever granted by an unauthenticated caller.
 */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'CRON_DISABLED', message: 'Credit grants are not enabled. Set CRON_SECRET to turn them on.' } },
      { status: 503 },
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: 'CRON_UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  }

  const db = createServiceClient()
  try {
    const [grants, janitor] = await Promise.all([runCreditGrants(db), runFlowJanitor(db)])
    return NextResponse.json({ ok: true, ...grants, ...janitor })
  } catch (err) {
    return handleError(err, 'CRON_IP_GRANTS_FAILED')
  }
}
