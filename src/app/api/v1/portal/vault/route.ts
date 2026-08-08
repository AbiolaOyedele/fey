import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as vault from '@/services/vault.service'
import type { VaultCategory, VaultEntryKind, VaultFilter } from '@/types/vault'

/**
 * GET /api/v1/portal/vault — the client's own documents.
 *
 * Read-only, and scoped entirely by the verified token: their invoices, their
 * contracts, files shared with them by name, and files the agency shared with
 * every client. Nothing private, and nothing belonging to another client.
 *
 * Both ids come from the token and never from the request, because this runs
 * service-role with no RLS underneath it — the scoping in
 * `listVaultForContact` is the only thing keeping one client out of another's
 * paperwork. There is no POST here on purpose: the Vault is the agency's
 * filing cabinet, and a client uploading into it would blur whose it is.
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response

  const sp = req.nextUrl.searchParams
  const db = createServiceClient()
  try {
    const filter: VaultFilter = {}
    const kind = sp.get('kind')
    if (kind) filter.kind = kind as VaultEntryKind | 'all'
    const category = sp.get('category')
    if (category) filter.category = category as VaultCategory | 'all'
    const search = sp.get('search')
    if (search) filter.search = search

    const entries = await vault.listVaultForContact(
      db, payload!.owner_id, payload!.contact_id, filter,
    )
    return NextResponse.json({ entries })
  } catch (err) {
    return handleError(err, 'PORTAL_VAULT_LIST_FAILED')
  }
}
