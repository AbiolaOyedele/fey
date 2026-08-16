import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import * as vault from '@/services/vault.service'

/**
 * PATCH  /api/v1/vault/notes/[id] — edit a note, or change who can see it.
 * DELETE /api/v1/vault/notes/[id] — remove it.
 *
 * PATCH is deliberately partial: ticking one checkbox in a note sends only the
 * new body, which keeps an autosave from overwriting a category or a share
 * setting someone changed in the meantime.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return errorResponse('VAULT_NOTE_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const note = await vault.editNote(db, ownerId, id, body)
    return NextResponse.json({ note })
  } catch (err) {
    return handleError(err, 'VAULT_NOTE_UPDATE_FAILED')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { id } = await params

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(
      db, user!.id, req.nextUrl.searchParams.get('workspace_id'),
    )
    await vault.removeNote(db, ownerId, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'VAULT_NOTE_DELETE_FAILED')
  }
}
