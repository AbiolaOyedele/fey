import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/supabase-server'
import { verifyPortalToken } from '@/lib/portal-jwt'
import { errorResponse, handleError } from '@/lib/api-helpers'
import { buildUploadSignature } from '@/services/upload.service'

/**
 * POST /api/v1/uploads/sign
 * Returns a short-lived Cloudinary upload signature. Accessible to either an
 * authenticated owner (Supabase) OR a portal client (custom JWT) — both upload
 * files. Requiring auth stops the signed preset from becoming an open upload
 * oracle. Body: { folder: string }.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  // Owner (Supabase) first, then portal client (custom JWT).
  const { user } = await verifyToken(authHeader)
  let authed = Boolean(user)
  if (!authed) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    authed = token ? Boolean(await verifyPortalToken(token)) : false
  }
  if (!authed) {
    return errorResponse('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  let body: { folder?: unknown }
  try {
    body = (await req.json()) as { folder?: unknown }
  } catch {
    body = {}
  }

  try {
    const signature = buildUploadSignature(body.folder)
    return NextResponse.json(signature)
  } catch (err) {
    return handleError(err, 'UPLOAD_SIGN_FAILED')
  }
}
