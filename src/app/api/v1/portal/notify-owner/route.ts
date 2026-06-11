import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmRepo from '@/repositories/crm.repository'
import { z } from 'zod'

const schema = z.object({
  owner_id:   z.string().uuid(),
  contact_id: z.string().uuid().nullable(),
  type:       z.string().min(1).max(100),
  message:    z.string().min(1).max(500),
})

/**
 * POST /api/v1/portal/notify-owner
 * Creates an in-app notification for the owner.
 * Caller must be authenticated as a portal user whose owner_id matches.
 */
export async function POST(req: NextRequest) {
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'PORTAL_NOTIFY_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'PORTAL_NOTIFY_VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }, { status: 400 })

  const db = createUserClient(token!)
  try {
    const notification = await crmRepo.createNotification(
      db,
      parsed.data.owner_id,
      parsed.data.contact_id,
      parsed.data.type,
      parsed.data.message,
    )
    return NextResponse.json({ notification }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_NOTIFY_FAILED')
  }
}
