import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { destroyCloudinaryAssetById } from '@/lib/cloudinary-server'
import * as vaultRepo from '@/repositories/vault.repository'
import {
  VAULT_CATEGORIES, VAULT_VISIBILITIES,
  type VaultEntry, type VaultFilter, type VaultItem,
} from '@/types/vault'

/**
 * The Agency Vault.
 *
 * Its whole job is to make three different things look like one list without
 * merging them in the database. An uploaded file is a `vault_items` row; an
 * invoice and a contract are read from their own tables and shaped into the
 * same envelope on the way out. Nothing is copied, so nothing can drift, and
 * an invoice marked paid elsewhere reads as paid here immediately.
 *
 * The trade is that invoices and contracts are read-only from here. That's the
 * honest behaviour — their real home is the invoice builder and the contracts
 * page, and a delete button in the Vault would promise something it shouldn't
 * keep.
 */

// ── Building entries ────────────────────────────────────────────────────────

function fromItem(item: VaultItem, names: Map<string, string>): VaultEntry {
  return {
    kind:          'file',
    id:            item.id,
    title:         item.title,
    subtitle:      item.description,
    category:      item.category,
    created_at:    item.created_at,
    href:          item.file_url,
    contact_id:    item.contact_id,
    contact_name:  item.contact_id ? names.get(item.contact_id) ?? null : null,
    file_name:     item.file_name,
    file_size:     item.file_size,
    file_type:     item.file_type,
    resource_type: item.resource_type,
    visibility:    item.visibility,
    description:   item.description,
  }
}

/** Money is formatted at the edge, where the currency is known. */
function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 })
      .format(amount)
  } catch {
    // An unrecognised currency code shouldn't take the whole list down.
    return `${currency} ${amount.toLocaleString()}`
  }
}

function fromInvoice(row: vaultRepo.VaultInvoiceRow, names: Map<string, string>): VaultEntry {
  const total = row.totals?.total ?? 0
  const currency = row.currency ?? 'USD'
  return {
    kind:          'invoice',
    id:            row.id,
    title:         row.invoice_number ? `Invoice ${row.invoice_number}` : 'Invoice',
    subtitle:      `${money(total, currency)} · ${row.status}`,
    category:      'finance',
    created_at:    row.created_at,
    // The share link is the only view a non-owner can open. Without one there's
    // nothing to link to, so the row lists but doesn't pretend to be openable.
    href:          row.share_token ? `/invoice/${row.share_token}` : null,
    contact_id:    row.crm_contact_id,
    contact_name:  row.crm_contact_id ? names.get(row.crm_contact_id) ?? null : null,
    file_name:     null,
    file_size:     null,
    file_type:     null,
    resource_type: null,
    visibility:    null,
    description:   null,
  }
}

function fromContract(row: vaultRepo.VaultContractRow, names: Map<string, string>): VaultEntry {
  return {
    kind:          'contract',
    id:            row.id,
    title:         row.title,
    subtitle:      row.signed_at ? 'Signed' : row.status,
    category:      'legal',
    created_at:    row.created_at,
    href:          row.share_token ? `/share/${row.share_token}` : null,
    contact_id:    row.contact_id,
    contact_name:  names.get(row.contact_id) ?? null,
    file_name:     null,
    file_size:     null,
    file_type:     null,
    resource_type: null,
    visibility:    null,
    description:   null,
  }
}

function matches(entry: VaultEntry, filter: VaultFilter): boolean {
  if (filter.kind && filter.kind !== 'all' && entry.kind !== filter.kind) return false
  if (filter.category && filter.category !== 'all' && entry.category !== filter.category) return false
  if (filter.contact_id && entry.contact_id !== filter.contact_id) return false
  if (filter.search) {
    const q = filter.search.toLowerCase()
    const haystack = [entry.title, entry.subtitle, entry.file_name, entry.contact_name]
      .filter(Boolean).join(' ').toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * The agency's own view: everything.
 *
 * `db` must be a user-scoped client. Invoices and contracts come back through
 * RLS, so a teammate without the `finance` capability simply gets no invoice
 * rows — the Vault doesn't need to know the rule, only to ask honestly.
 */
export async function listVault(
  db: SupabaseClient,
  ownerId: string,
  filter: VaultFilter = {},
): Promise<VaultEntry[]> {
  const [items, invoices, contracts, names] = await Promise.all([
    vaultRepo.listItems(db, ownerId),
    vaultRepo.listInvoices(db, ownerId),
    vaultRepo.listContracts(db, ownerId),
    vaultRepo.contactNames(db, ownerId),
  ])

  return [
    ...items.map((i) => fromItem(i, names)),
    ...invoices.map((i) => fromInvoice(i, names)),
    ...contracts.map((c) => fromContract(c, names)),
  ]
    .filter((e) => matches(e, filter))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/**
 * One client's view, from inside their portal.
 *
 * Everything is fenced to their own contact: their invoices, their contracts,
 * files shared with them by name, and files shared with every client. Nothing
 * private, and nothing belonging to another client — `db` here is service-role
 * with no RLS behind it, so this scoping is the only thing keeping one client
 * out of another's documents.
 */
export async function listVaultForContact(
  db: SupabaseClient,
  ownerId: string,
  contactId: string,
  filter: VaultFilter = {},
): Promise<VaultEntry[]> {
  const [items, invoices, contracts, names] = await Promise.all([
    vaultRepo.listItemsForContact(db, ownerId, contactId),
    vaultRepo.listInvoices(db, ownerId, contactId),
    vaultRepo.listContracts(db, ownerId, contactId),
    vaultRepo.contactNames(db, ownerId),
  ])

  return [
    ...items.map((i) => fromItem(i, names)),
    ...invoices.map((i) => fromInvoice(i, names)),
    ...contracts.map((c) => fromContract(c, names)),
  ]
    .filter((e) => matches(e, filter))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

// ── Writes ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  title:         z.string().min(1, 'Give this a name.').max(200).trim(),
  description:   z.string().max(2000).trim().nullish(),
  category:      z.enum(VAULT_CATEGORIES),
  file_name:     z.string().min(1).max(500),
  file_url:      z.string().url('That file couldn’t be saved.'),
  public_id:     z.string().min(1),
  file_size:     z.number().int().nonnegative().nullish(),
  file_type:     z.string().max(200).nullish(),
  resource_type: z.enum(['image', 'video', 'raw']),
  visibility:    z.enum(VAULT_VISIBILITIES),
  contact_id:    z.string().uuid().nullish(),
})

/**
 * The pairing rule, enforced in one place because both create and update need
 * it and the two must not disagree.
 *
 * A 'client' item without a contact would be visible to nobody; a 'private' or
 * 'all_clients' item still carrying a contact_id is how a stale share leaks
 * one client's name into another's view. The database has the same constraint
 * — this exists to turn it into a sentence someone can act on.
 */
function normaliseVisibility(
  visibility: 'private' | 'client' | 'all_clients',
  contactId: string | null | undefined,
): string | null {
  if (visibility === 'client') {
    if (!contactId) {
      throw new AppError(400, 'Choose which client should see this.', 'VAULT_ITEM_NO_CLIENT')
    }
    return contactId
  }
  return null
}

export async function addItem(
  db: SupabaseClient,
  ownerId: string,
  userId: string,
  input: unknown,
): Promise<VaultItem> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Those details aren’t valid.', 'VAULT_ITEM_INVALID')
  }
  const payload = parsed.data
  const contactId = normaliseVisibility(payload.visibility, payload.contact_id)

  return vaultRepo.insertItem(db, ownerId, userId, {
    ...payload,
    description: payload.description ?? null,
    file_size:   payload.file_size ?? null,
    file_type:   payload.file_type ?? null,
    contact_id:  contactId,
  })
}

const updateSchema = z.object({
  title:       z.string().min(1, 'Give this a name.').max(200).trim().optional(),
  description: z.string().max(2000).trim().nullish(),
  category:    z.enum(VAULT_CATEGORIES).optional(),
  visibility:  z.enum(VAULT_VISIBILITIES).optional(),
  contact_id:  z.string().uuid().nullish(),
})

export async function editItem(
  db: SupabaseClient,
  ownerId: string,
  id: string,
  input: unknown,
): Promise<VaultItem> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That change isn’t valid.', 'VAULT_ITEM_INVALID')
  }

  const existing = await vaultRepo.getItem(db, id)
  if (!existing || existing.owner_id !== ownerId) {
    throw new AppError(404, 'That document could not be found.', 'VAULT_ITEM_NOT_FOUND')
  }

  const patch: Record<string, unknown> = {}
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.description !== undefined) patch.description = parsed.data.description ?? null
  if (parsed.data.category !== undefined) patch.category = parsed.data.category

  // Visibility and contact move together or not at all — changing one without
  // the other is what trips the database constraint.
  if (parsed.data.visibility !== undefined) {
    patch.visibility = parsed.data.visibility
    patch.contact_id = normaliseVisibility(
      parsed.data.visibility,
      parsed.data.contact_id ?? existing.contact_id,
    )
  } else if (parsed.data.contact_id !== undefined && existing.visibility === 'client') {
    patch.contact_id = normaliseVisibility('client', parsed.data.contact_id)
  }

  if (Object.keys(patch).length === 0) {
    throw new AppError(400, 'Nothing to change.', 'VAULT_ITEM_INVALID')
  }
  return vaultRepo.updateItem(db, id, patch)
}

/**
 * Removes the row and the stored file.
 *
 * The row goes first. If Cloudinary then fails the asset is orphaned, which
 * costs storage — the other order risks a row pointing at a file that no
 * longer exists, which shows the user a broken document.
 */
export async function removeItem(
  db: SupabaseClient,
  ownerId: string,
  id: string,
): Promise<void> {
  const existing = await vaultRepo.getItem(db, id)
  if (!existing || existing.owner_id !== ownerId) {
    throw new AppError(404, 'That document could not be found.', 'VAULT_ITEM_NOT_FOUND')
  }

  await vaultRepo.deleteItem(db, id)

  try {
    await destroyCloudinaryAssetById(existing.public_id, existing.resource_type)
  } catch (err) {
    console.error('[VAULT_ASSET_CLEANUP_FAILED]', { id, publicId: existing.public_id, err })
  }
}
