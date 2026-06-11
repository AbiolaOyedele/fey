import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'

/**
 * Generates a random 8-character uppercase alphanumeric invite code.
 * Avoids ambiguous chars (0/O, 1/I/L).
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * GET /api/v1/crm/contacts/[contactId]/invite
 *
 * Returns the contact's current invite code, generating one if it doesn't exist.
 * Response: { invite_code: string, invite_url: string }
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

    // Generate a code if one doesn't exist yet
    let inviteCode = row.invite_code
    if (!inviteCode) {
      // Retry up to 5 times on collision (extremely unlikely)
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateInviteCode()
        const { error: updateErr } = await db
          .from('crm_contacts')
          .update({ invite_code: candidate })
          .eq('id', contactId)
        if (!updateErr) { inviteCode = candidate; break }
      }
    }

    if (!inviteCode) {
      return errorResponse('INVITE_CODE_FAILED', 'Could not generate invite code.', 500)
    }

    // Build the full join URL — workspace_slug comes from fey_settings
    const { data: settings } = await db
      .from('fey_settings')
      .select('workspace_slug')
      .eq('user_id', userId)
      .maybeSingle()

    const slug      = (settings as { workspace_slug: string | null } | null)?.workspace_slug ?? ''
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency'
    const inviteUrl  = slug
      ? `https://${slug}.${rootDomain}/join?code=${inviteCode}`
      : `/portal/${slug}/join?code=${inviteCode}`

    return NextResponse.json({ invite_code: inviteCode, invite_url: inviteUrl })
  } catch (err) {
    return handleError(err, 'INVITE_CODE_FETCH_FAILED')
  }
}

/**
 * POST /api/v1/crm/contacts/[contactId]/invite
 *
 * Regenerates the invite code (invalidates the old one).
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

    // Generate new code
    let inviteCode: string | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateInviteCode()
      const { error: updateErr } = await db
        .from('crm_contacts')
        .update({ invite_code: candidate })
        .eq('id', contactId)
      if (!updateErr) { inviteCode = candidate; break }
    }

    if (!inviteCode) {
      return errorResponse('INVITE_CODE_FAILED', 'Could not generate invite code.', 500)
    }

    const { data: settings } = await db
      .from('fey_settings')
      .select('workspace_slug')
      .eq('user_id', userId)
      .maybeSingle()

    const slug       = (settings as { workspace_slug: string | null } | null)?.workspace_slug ?? ''
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency'
    const inviteUrl  = slug
      ? `https://${slug}.${rootDomain}/join?code=${inviteCode}`
      : `/portal/${slug}/join?code=${inviteCode}`

    return NextResponse.json({ invite_code: inviteCode, invite_url: inviteUrl })
  } catch (err) {
    return handleError(err, 'INVITE_CODE_REGEN_FAILED')
  }
}
