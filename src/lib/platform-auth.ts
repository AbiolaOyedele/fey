import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-helpers'
import { env } from '@/config/env'

/**
 * Authentication for the PlayGround control plane, which polls this app's
 * /api/v1/admin/platform/* endpoints.
 *
 * Follows the shared-secret pattern already established by the cron routes and
 * /api/v1/internal/messages/notify: a secret in a header, and the route disabled
 * entirely (503) until that secret is configured, so an unset secret can never
 * leave the endpoint open.
 *
 * Returns a NextResponse to short-circuit with, or null to proceed — matching
 * the `requireAuth` / `requirePortalAuth` convention in api-helpers.ts rather
 * than throwing.
 */

export const PLATFORM_KEY_HEADER = 'x-playground-service-key'

/**
 * Constant-time secret comparison. Both sides are hashed to a fixed 32 bytes
 * first because `timingSafeEqual` throws on a length mismatch, which would
 * itself leak the expected length.
 *
 * Note this is stricter than the existing `!==` checks on the cron and webhook
 * routes; those are worth tightening the same way when they are next touched.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const left = createHash('sha256').update(a, 'utf8').digest()
  const right = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(left, right)
}

export function requirePlatformKey(headers: Headers): NextResponse | null {
  const expected = env.ADMIN_API_SERVICE_KEY

  if (!expected) {
    return errorResponse('PLATFORM_API_DISABLED', 'This endpoint is not enabled.', 503)
  }

  const presented = headers.get(PLATFORM_KEY_HEADER)

  // Missing and wrong are answered identically so probing reveals nothing.
  if (!presented || !timingSafeCompare(presented, expected)) {
    return errorResponse(
      'PLATFORM_AUTH_UNAUTHORIZED',
      'You are not authorised to perform this action.',
      401,
    )
  }

  return null
}
