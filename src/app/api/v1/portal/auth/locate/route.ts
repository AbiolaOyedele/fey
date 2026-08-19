import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { errorResponse, handleError } from '@/lib/api-helpers'
import { rateLimit } from '@/lib/rate-limit'
import { locatePortalAccount } from '@/services/portal.service'

const locateSchema = z.object({
  email:    z.string().email().toLowerCase(),
  password: z.string().min(1).max(128),
})

/**
 * POST /api/v1/portal/auth/locate
 *
 * "These are client details — which portal are they for?" Called by the agency
 * sign-in form after Supabase Auth rejects a set of credentials, so someone who
 * arrived at the wrong door is sent to the right one instead of being told
 * their correct password is wrong. See `locatePortalAccount` for why this
 * doesn't leak: it answers only when the password verifies.
 *
 * Rate limited on the address as well as the caller. Needing no workspace_slug
 * is the point of the endpoint, and also what would make it the cheapest way to
 * try one password against every workspace at once.
 *
 * Body:     { email, password }
 * Response: { found: false } | { found: true, workspace_slug, business_name }
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PORTAL_LOCATE_INVALID_BODY', 'Invalid request body.', 400)
  }

  const parsed = locateSchema.safeParse(body)
  // Runs as a courtesy after a failed sign-in and has nothing useful to say
  // about a malformed address, so it says nothing rather than raising an error.
  if (!parsed.success) return NextResponse.json({ found: false })

  const { email, password } = parsed.data
  const caller = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  for (const key of [`portal-locate:ip:${caller}`, `portal-locate:email:${email}`]) {
    const limit = rateLimit(key, 5, 60_000)
    if (!limit.allowed) {
      const res = errorResponse('PORTAL_LOCATE_RATE_LIMITED', 'Too many attempts. Please wait a moment.', 429)
      res.headers.set('Retry-After', String(limit.retryAfter))
      return res
    }
  }

  try {
    const found = await locatePortalAccount(createServiceClient(), email, password)
    return NextResponse.json(found ? { found: true, ...found } : { found: false })
  } catch (err) {
    return handleError(err, 'PORTAL_LOCATE_FAILED')
  }
}
