import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as portalRepo from '@/repositories/portal.repository'

/**
 * PATCH /api/v1/portal/profile
 *
 * Lets a client correct their own display name without going through the
 * agency. Deliberately name-only: email is the login identity and changing it
 * needs a verification flow, so it stays with the team for now.
 */
const schema = z.object({
  name: z.string().min(1, 'Your name can’t be empty.').max(200).trim(),
})

export async function PATCH(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('PORTAL_PROFILE_INVALID', 'That request isn’t valid.', 400)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      'PORTAL_PROFILE_INVALID',
      parsed.error.issues[0]?.message ?? 'That name isn’t valid.',
      400,
    )
  }

  const db = createServiceClient()
  try {
    // Scoped by contact_id from the token, so this can only ever rename the
    // caller's own row.
    const user = await portalRepo.updatePortalUserName(
      db,
      payload!.portal_user_id,
      payload!.contact_id,
      parsed.data.name,
    )
    return NextResponse.json({ user })
  } catch (err) {
    return handleError(err, 'PORTAL_PROFILE_UPDATE_FAILED')
  }
}
