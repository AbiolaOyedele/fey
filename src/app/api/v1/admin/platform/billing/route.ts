import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformKey } from '@/lib/platform-auth'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError } from '@/lib/api-helpers'
import { getBilling } from '@/services/platform.service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/admin/platform/billing
 *
 * Read-only invoice rollup. Totals only, never anything identifying a client.
 *
 * Auth: PlayGround service key in `x-playground-service-key`. Machine-to-machine —
 * the ADMIN_EMAILS allowlist used by /api/v1/admin/metrics is session-based and
 * no use to a server caller. Returns 503 until ADMIN_API_SERVICE_KEY is set.
 *
 * NOTE: this app has no rate limiter. Flagged rather than adding a dependency
 * for three endpoints — there is one known consumer, behind a shared secret.
 */
export async function GET(req: NextRequest) {
  const unauthorized = requirePlatformKey(req.headers)
  if (unauthorized) return unauthorized

  try {
    const db = createServiceClient()
    return NextResponse.json(await getBilling(db))
  } catch (err) {
    return handleError(err, 'PLATFORM_BILLING_FAILED')
  }
}
