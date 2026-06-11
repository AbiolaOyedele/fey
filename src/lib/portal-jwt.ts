/**
 * Custom JWT for portal client sessions.
 *
 * Portal clients are NOT Supabase Auth users — they have independent
 * per-workspace credentials (bcrypt password, custom JWT).
 *
 * Token is stored in localStorage as `portal_token_${workspaceSlug}`.
 * All portal API routes verify this token server-side using verifyPortalToken().
 */

import { SignJWT, jwtVerify } from 'jose'

export interface PortalTokenPayload {
  /** portal_users.id (a plain UUID — not linked to auth.users) */
  portal_user_id: string
  /** crm_contacts.id the portal user represents */
  contact_id:     string
  /** auth.users.id of the workspace owner */
  owner_id:       string
  /** fey_settings.workspace_slug */
  workspace_slug: string
}

function getSecret(): Uint8Array {
  const secret = process.env.PORTAL_JWT_SECRET
  if (!secret) throw new Error('PORTAL_JWT_SECRET environment variable is not set.')
  return new TextEncoder().encode(secret)
}

/**
 * Issues a signed portal token with a 30-day expiry.
 * Clients expect to stay logged in; 30 days is reasonable.
 */
export async function signPortalToken(payload: PortalTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

/**
 * Verifies a portal token.
 * Returns the payload if valid, null if expired or tampered.
 */
export async function verifyPortalToken(token: string): Promise<PortalTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      portal_user_id: payload['portal_user_id'] as string,
      contact_id:     payload['contact_id']     as string,
      owner_id:       payload['owner_id']        as string,
      workspace_slug: payload['workspace_slug']  as string,
    }
  } catch {
    return null
  }
}
