import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import * as vault from '@/services/vault.service'
import type { VaultCategory, VaultEntryKind, VaultFilter } from '@/types/vault'

/**
 * GET  /api/v1/vault — every document in one list: uploads, invoices, contracts.
 * POST /api/v1/vault — record an uploaded document (the file is already stored).
 *
 * Deliberately a user-scoped client throughout. Invoices and contracts come
 * back through RLS, so a teammate without the `finance` capability sees no
 * invoices here without the Vault having to know that rule exists.
 */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const sp = req.nextUrl.searchParams
  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, sp.get('workspace_id'))

    const filter: VaultFilter = {}
    const kind = sp.get('kind')
    if (kind) filter.kind = kind as VaultEntryKind | 'all'
    const category = sp.get('category')
    if (category) filter.category = category as VaultCategory | 'all'
    const contactId = sp.get('contact_id')
    if (contactId) filter.contact_id = contactId
    const search = sp.get('search')
    if (search) filter.search = search

    const entries = await vault.listVault(db, ownerId, filter)
    return NextResponse.json({ entries })
  } catch (err) {
    return handleError(err, 'VAULT_LIST_FAILED')
  }
}

export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return errorResponse('VAULT_ITEM_INVALID', 'That request isn’t valid.', 400)
  }

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const item = await vault.addItem(db, ownerId, user!.id, body)
    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    return handleError(err, 'VAULT_ITEM_CREATE_FAILED')
  }
}
