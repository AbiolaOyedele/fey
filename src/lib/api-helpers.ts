import { NextResponse } from 'next/server'
import { isAppError } from '@/lib/errors'
import { verifyToken, createServiceClient } from '@/lib/supabase-server'
import { verifyPortalToken, type PortalTokenPayload } from '@/lib/portal-jwt'
import { getPortalAccessState } from '@/repositories/portal.repository'

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function requireAuth(authHeader: string | null) {
  const { user, token } = await verifyToken(authHeader)
  if (!user || !token) return { user: null, token: null, response: errorResponse('AUTH_REQUIRED', 'Authentication required.', 401) }
  return { user, token, response: null }
}

/**
 * Verifies a portal client's custom JWT (not a Supabase Auth token).
 * Portal clients have independent per-workspace credentials.
 *
 * The signature check alone is not enough. Portal tokens last 30 days and
 * nothing can recall one, so a member who has been revoked or deleted would
 * otherwise keep reading invoices, contracts, files and tasks for the rest of
 * that month. Access is therefore confirmed against the database on every
 * request: one indexed primary-key read of two columns, which is the price of
 * "remove access" meaning it.
 *
 * This is the read side. Write paths additionally go through
 * `requireCapability`, which re-reads the role for the same reason.
 */
export async function requirePortalAuth(authHeader: string | null): Promise<{
  payload: PortalTokenPayload | null
  response: NextResponse | null
}> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return { payload: null, response: errorResponse('AUTH_REQUIRED', 'Authentication required.', 401) }
  }
  const payload = await verifyPortalToken(token)
  if (!payload) {
    return { payload: null, response: errorResponse('PORTAL_TOKEN_INVALID', 'Your session has expired. Please sign in again.', 401) }
  }

  let access: { exists: boolean; revokedAt: string | null }
  try {
    access = await getPortalAccessState(createServiceClient(), payload.portal_user_id)
  } catch (err) {
    // Failing open would let a revoked token through on any database blip, so
    // an unreachable check is treated as no access.
    console.error('[PORTAL_ACCESS_CHECK_FAILED]', err)
    return {
      payload: null,
      response: errorResponse('PORTAL_ACCESS_CHECK_FAILED', 'We couldn’t confirm your access. Please try again.', 503),
    }
  }

  if (!access.exists) {
    return {
      payload: null,
      response: errorResponse('PORTAL_ACCESS_REMOVED', 'Your access to this portal has been removed.', 401),
    }
  }
  if (access.revokedAt) {
    return {
      payload: null,
      response: errorResponse('PORTAL_ACCESS_REVOKED', 'Your access to this portal has been turned off. Please contact your team.', 403),
    }
  }

  return { payload, response: null }
}

export function handleError(err: unknown, fallbackCode: string): NextResponse {
  if (isAppError(err)) return errorResponse(err.code, err.message, err.statusCode)
  console.error(`[${fallbackCode}]`, err)
  return errorResponse(fallbackCode, 'Something went wrong. Please try again.', 500)
}
