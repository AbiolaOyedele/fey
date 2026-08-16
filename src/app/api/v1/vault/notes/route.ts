import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import * as vault from '@/services/vault.service'

/**
 * POST /api/v1/vault/notes — write a new note into the Vault.
 *
 * Notes are listed by GET /api/v1/vault alongside everything else, so there's
 * no list endpoint here. This route exists only because a note is created
 * differently from an upload: there is no file, and nothing to store first.
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return errorResponse('VAULT_NOTE_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const note = await vault.addNote(db, ownerId, user!.id, body)
    return NextResponse.json({ note }, { status: 201 })
  } catch (err) {
    return handleError(err, 'VAULT_NOTE_CREATE_FAILED')
  }
}
