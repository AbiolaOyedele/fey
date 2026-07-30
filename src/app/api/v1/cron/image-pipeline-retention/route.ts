import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError } from '@/lib/api-helpers'
import { env } from '@/config/env'
import { runRetentionSweep } from '@/services/image-pipeline/maintenance.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/v1/cron/image-pipeline-retention — daily.
 *
 * Deletes the Cloudinary assets for runs past their retention deadline (1 or 2
 * weeks, the user's choice) and marks those runs expired.
 *
 * SAFETY: disabled until CRON_SECRET is set, and every request must present it
 * — nothing is ever auto-deleted until you explicitly configure the secret.
 */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'CRON_DISABLED', message: 'Image retention is not enabled. Set CRON_SECRET to turn it on.' } },
      { status: 503 },
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: 'CRON_UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  }

  const db = createServiceClient()
  try {
    return NextResponse.json({ ok: true, ...(await runRetentionSweep(db)) })
  } catch (err) {
    return handleError(err, 'CRON_IP_RETENTION_FAILED')
  }
}
