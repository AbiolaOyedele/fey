import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import { notifyOwnerAdmins } from '@/services/notifications.service'
import { z } from 'zod'

const schema = z.object({
  type:    z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  // contact_id is optional override — defaults to the JWT's contact_id
  contact_id: z.string().uuid().optional().nullable(),
})

/**
 * POST /api/v1/portal/notify-owner
 * Creates an in-app notification for the workspace owner.
 * Caller must be authenticated as a portal user.
 */
export async function POST(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'PORTAL_NOTIFY_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'PORTAL_NOTIFY_VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }, { status: 400 })
  }

  const db = createServiceClient()
  const contactId = parsed.data.contact_id ?? payload!.contact_id
  try {
    await notifyOwnerAdmins(db, payload!.owner_id, {
      type: parsed.data.type,
      title: parsed.data.message,
      link: `/clients/${contactId}/messages`,
      entityType: 'contact',
      entityId: contactId,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_NOTIFY_FAILED')
  }
}
