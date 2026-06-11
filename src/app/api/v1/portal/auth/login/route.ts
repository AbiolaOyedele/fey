import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase-server'
import { signPortalToken } from '@/lib/portal-jwt'
import { handleError, errorResponse } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'
import { z } from 'zod'

const loginSchema = z.object({
  workspace_slug: z.string().min(1),
  email:          z.string().email().toLowerCase(),
  password:       z.string().min(1),
})

/**
 * POST /api/v1/portal/auth/login
 *
 * Authenticates a portal client and returns a signed JWT.
 * Credentials are scoped to a workspace — the same email with a
 * different password can exist in another workspace without conflict.
 *
 * Body: { workspace_slug, email, password }
 * Response: { token, user: { id, name, email, contact_id } }
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PORTAL_LOGIN_INVALID_BODY', 'Invalid request body.', 400)
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      'PORTAL_LOGIN_VALIDATION',
      parsed.error.issues[0]?.message ?? 'Invalid login details.',
      400,
    )
  }

  const { workspace_slug, email, password } = parsed.data

  try {
    const db = createServiceClient()

    // Look up the portal user by workspace + email
    const portalUser = await portalRepo.getPortalUserByWorkspaceAndEmail(db, workspace_slug, email)

    // Constant-time response to prevent user enumeration
    const DUMMY_HASH = '$2b$12$invaliddummyhashfortimingreasons000000000000000000000000'
    const hashToCheck = portalUser?.password_hash ?? DUMMY_HASH

    const passwordValid = await bcrypt.compare(password, hashToCheck)

    if (!portalUser || !passwordValid) {
      return errorResponse('PORTAL_LOGIN_INVALID', 'Invalid email or password.', 401)
    }

    // Issue a custom JWT — 30-day expiry
    const token = await signPortalToken({
      portal_user_id: portalUser.id,
      contact_id:     portalUser.contact_id,
      owner_id:       portalUser.owner_id,
      workspace_slug: portalUser.workspace_slug,
    })

    return NextResponse.json({
      token,
      user: {
        id:         portalUser.id,
        name:       portalUser.name,
        email:      portalUser.email,
        contact_id: portalUser.contact_id,
      },
    })
  } catch (err) {
    return handleError(err, 'PORTAL_LOGIN_FAILED')
  }
}
