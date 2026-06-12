import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generates a random 8-character uppercase alphanumeric invite code.
 * Avoids ambiguous chars (0/O, 1/I/L).
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
  return code
}

/**
 * Fetches the owner's workspace_slug from fey_settings and builds the full
 * invite join URL.  Shared by GET (lazy-generate) and POST (regenerate).
 *
 * NOTE: subdomain routing ([slug].theruff.agency) is not wired — there is no
 * middleware/rewrite mapping a host's subdomain to /portal/[subdomain]. So we
 * emit the PATH-based URL (<host>/portal/<slug>/join), which hits the
 * /portal/[subdomain]/join route directly and actually resolves. The host is
 * taken from the request so the link points back at whatever domain the owner
 * is using (e.g. dashboard.theruff.agency).
 */
async function buildInviteUrl(req: NextRequest, db: SupabaseClient, userId: string, code: string): Promise<string> {
  const { data } = await db
    .from('fey_settings')
    .select('workspace_slug')
    .eq('user_id', userId)
    .maybeSingle()

  const slug  = (data as { workspace_slug: string | null } | null)?.workspace_slug ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host  = req.headers.get('host') ?? process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency'
  return `${proto}://${host}/portal/${slug}/join?code=${code}`
}

/**
 * GET /api/v1/crm/contacts/[contactId]/invite
 *
 * Returns the contact's current invite code, generating one if it doesn't
 * exist yet.  Response: { invite_code: string, invite_url: string }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  const userId = user?.id
  if (response) return response

  const { contactId } = await params

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
 * POST /api/v1/crm/contacts/[contactId]/invite
 *
 * Regenerates the invite code, invalidating the previous one.
 * Response: { invite_code: string, invite_url: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  const userId = user?.id
  if (response) return response

  const { contactId } = await params

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
