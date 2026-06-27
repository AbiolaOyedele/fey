import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generates a random 8-character uppercase alphanumeric invite code using a
 * cryptographically-secure RNG (not Math.random, which is predictable and would
 * let codes be guessed/reproduced). Avoids ambiguous chars (0/O, 1/I/L).
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < 8; i++) code += chars.charAt(bytes[i] % chars.length)
  return code
}

/**
 * Fetches the owner's workspace_slug and builds the branded invite join URL on
 * the workspace subdomain — https://<slug>.theruff.agency/join?code=...
 * The subdomain proxy (src/proxy.ts) rewrites /join → /portal/<slug>/signup.
 * Falls back to a path-based URL on the current host if no slug is set yet.
 */
async function buildInviteUrl(req: NextRequest, db: SupabaseClient, userId: string, code: string): Promise<string> {
  const { data } = await db
    .from('fey_settings')
    .select('workspace_slug')
    .eq('user_id', userId)
    .maybeSingle()

  const slug       = (data as { workspace_slug: string | null } | null)?.workspace_slug ?? ''
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency'
  if (slug) return `https://${slug}.${rootDomain}/join?code=${code}`

  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host  = req.headers.get('host') ?? rootDomain
  return `${proto}://${host}/portal/${slug}/join?code=${code}`
}

/**
 * GET /api/v1/crm/contacts/[id]/invite
 *
 * Returns the contact's current invite code, generating one if it doesn't
 * exist yet.  Response: { invite_code: string, invite_url: string }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  const userId = user?.id
  if (response) return response

  const { id: contactId } = await params

  try {
    const db = createServiceClient()

    // Fetch the contact and verify ownership
    const { data: contact, error } = await db
      .from('crm_contacts')
      .select('id, owner_id, portal_enabled, invite_code')
      .eq('id', contactId)
      .maybeSingle()

    if (error ?? !contact) return errorResponse('CRM_CONTACT_NOT_FOUND', 'Contact not found.', 404)
    if ((contact as { owner_id: string }).owner_id !== userId) {
      return errorResponse('CRM_ACCESS_DENIED', 'Access denied.', 403)
    }

    const row = contact as { id: string; owner_id: string; portal_enabled: boolean; invite_code: string | null }

    // Lazily generate a code — retry up to 5× on (extremely unlikely) collision
    let inviteCode = row.invite_code
    if (!inviteCode) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateInviteCode()
        const { error: updateErr } = await db
          .from('crm_contacts')
          .update({ invite_code: candidate })
          .eq('id', contactId)
        if (!updateErr) { inviteCode = candidate; break }
      }
    }

    if (!inviteCode) return errorResponse('INVITE_CODE_FAILED', 'Could not generate invite code.', 500)

    const inviteUrl = await buildInviteUrl(req, db, userId!, inviteCode)
    return NextResponse.json({ invite_code: inviteCode, invite_url: inviteUrl })
  } catch (err) {
    return handleError(err, 'INVITE_CODE_FETCH_FAILED')
  }
}

/**
 * POST /api/v1/crm/contacts/[id]/invite
 *
 * Regenerates the invite code, invalidating the previous one.
 * Response: { invite_code: string, invite_url: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  const userId = user?.id
  if (response) return response

  const { id: contactId } = await params

  try {
    const db = createServiceClient()

    // Ownership check
    const { data: contact, error } = await db
      .from('crm_contacts')
      .select('id, owner_id')
      .eq('id', contactId)
      .maybeSingle()

    if (error ?? !contact) return errorResponse('CRM_CONTACT_NOT_FOUND', 'Contact not found.', 404)
    if ((contact as { owner_id: string }).owner_id !== userId) {
      return errorResponse('CRM_ACCESS_DENIED', 'Access denied.', 403)
    }

    // Force-generate a fresh code
    let inviteCode: string | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateInviteCode()
      const { error: updateErr } = await db
        .from('crm_contacts')
        .update({ invite_code: candidate })
        .eq('id', contactId)
      if (!updateErr) { inviteCode = candidate; break }
    }

    if (!inviteCode) return errorResponse('INVITE_CODE_FAILED', 'Could not generate invite code.', 500)

    const inviteUrl = await buildInviteUrl(req, db, userId!, inviteCode)
    return NextResponse.json({ invite_code: inviteCode, invite_url: inviteUrl })
  } catch (err) {
    return handleError(err, 'INVITE_CODE_REGEN_FAILED')
  }
}
