import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError } from '@/lib/api-helpers'
import { env } from '@/config/env'
import * as taskDigestService from '@/services/task-digest.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/v1/cron/task-digest
 *
 * Daily task-digest email sweep (wired via vercel.json crons, 7am UTC / 8am
 * WAT). For each user with the digest enabled (fey_settings.task_digest_enabled),
 * sends a summary of due/overdue, recently assigned, and completed-yesterday
 * tasks — skipping anyone with nothing to report and anyone already sent today.
 *
 * SAFETY: disabled until CRON_SECRET is set, and every request must present it
 * (Vercel Cron injects `Authorization: Bearer <CRON_SECRET>`). So nothing is
 * ever emailed until you explicitly configure the secret.
 */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'CRON_DISABLED', message: 'Task digest is not enabled. Set CRON_SECRET to turn it on.' } },
      { status: 503 },
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: 'CRON_UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  }

  const db = createServiceClient()
  try {
    const result = await taskDigestService.runDailyDigest(db)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return handleError(err, 'CRON_TASK_DIGEST_FAILED')
  }
}
