import { NextResponse } from 'next/server'
import { env } from '@/config/env'

// Must always reflect the live deployment — never cache.
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/version
 *
 * Returns the commit SHA of the currently-deployed server. The running client
 * compares this against the build id baked into its bundle (NEXT_PUBLIC_BUILD_ID)
 * to detect when a newer version has been deployed.
 */
export function GET() {
  return NextResponse.json(
    { build: env.VERCEL_GIT_COMMIT_SHA ?? 'dev' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
