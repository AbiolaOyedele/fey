import { NextResponse } from 'next/server'
import { isAppError } from '@/lib/errors'
import { verifyToken } from '@/lib/supabase-server'

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function requireAuth(authHeader: string | null) {
  const { user, token } = await verifyToken(authHeader)
  if (!user || !token) return { user: null, token: null, response: errorResponse('AUTH_REQUIRED', 'Authentication required.', 401) }
  return { user, token, response: null }
}

export function handleError(err: unknown, fallbackCode: string): NextResponse {
  if (isAppError(err)) return errorResponse(err.code, err.message, err.statusCode)
  console.error(`[${fallbackCode}]`, err)
  return errorResponse(fallbackCode, 'Something went wrong. Please try again.', 500)
}
