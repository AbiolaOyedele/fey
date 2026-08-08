import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import * as vault from '@/services/vault.service'

/**
 * PATCH  /api/v1/vault/[id] — rename, recategorise, or change who can see it.
 * DELETE /api/v1/vault/[id] — remove the entry and the stored file.
 *
 * Uploaded documents only. Invoices and contracts are listed by the Vault but
 * owned by their own pages, and there is deliberately no route here that would
 * let the Vault delete one.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return errorResponse('VAULT_ITEM_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const item = await vault.editItem(db, ownerId, id, body)
    return NextResponse.json({ item })
  } catch (err) {
    return handleError(err, 'VAULT_ITEM_UPDATE_FAILED')
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
    await vault.removeItem(db, ownerId, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'VAULT_ITEM_DELETE_FAILED')
  }
}
