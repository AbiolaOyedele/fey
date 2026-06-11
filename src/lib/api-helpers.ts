import { NextResponse } from 'next/server'
import { isAppError } from '@/lib/errors'
import { verifyToken } from '@/lib/supabase-server'
import { verifyPortalToken, type PortalTokenPayload } from '@/lib/portal-jwt'

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
  return { payload, response: null }
}

export function handleError(err: unknown, fallbackCode: string): NextResponse {
  if (isAppError(err)) return errorResponse(err.code, err.message, err.statusCode)
  console.error(`[${fallbackCode}]`, err)
  return errorResponse(fallbackCode, 'Something went wrong. Please try again.', 500)
}
