import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'

/**
 * PATCH  /api/v1/crm/messages/[messageId] — edit the owner's own message.
 * DELETE /api/v1/crm/messages/[messageId] — unsend for everyone (soft delete).
 *
 * Both run on a USER-scoped client, so RLS is what proves the message belongs to
 * the caller's workspace. The service adds the rules RLS can't express: you may
 * remove anyone's message in your own thread, but you may only edit your own.
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('CRM_MESSAGE_INVALID', 'That request isn’t valid.', 400)
  }

  try {
    const message = await crmService.editMessage(createUserClient(token!), messageId, user!.id, body)
    return NextResponse.json({ message })
  } catch (err) {
    return handleError(err, 'CRM_MESSAGE_EDIT_FAILED')
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  try {
    const message = await crmService.deleteMessage(createUserClient(token!), messageId, user!.id)
    return NextResponse.json({ message })
  } catch (err) {
    return handleError(err, 'CRM_MESSAGE_DELETE_FAILED')
  }
}
