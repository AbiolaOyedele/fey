import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError } from '@/lib/api-helpers'
import { env } from '@/config/env'
import * as crmService from '@/services/crm.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/v1/cron/prune-messages
 *
 * Daily retention sweep (wired via vercel.json crons). Deletes each owner's
 * messages older than their message_retention_days (default 60).
 *
 * SAFETY: disabled until CRON_SECRET is set, and every request must present it
 * (Vercel Cron injects `Authorization: Bearer <CRON_SECRET>`). So nothing is
 * ever auto-deleted until you explicitly configure the secret.
 */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'CRON_DISABLED', message: 'Retention is not enabled. Set CRON_SECRET to turn it on.' } },
      { status: 503 },
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: 'CRON_UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  }

  const db = createServiceClient()
  try {
    const result = await crmService.pruneExpiredMessages(db)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return handleError(err, 'CRON_PRUNE_FAILED')
  }
}
