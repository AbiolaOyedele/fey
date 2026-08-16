import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateVaultItemPayload, CreateVaultNotePayload,
  UpdateVaultItemPayload, UpdateVaultNotePayload, VaultItem, VaultNote,
} from '@/types/vault'

/**
 * Every query the Vault makes.
 *
 * Four sources, kept apart on purpose: `vault_items` holds what was uploaded
 * and `vault_notes` what was written here, while invoices and contracts are
 * read from their own tables and never copied. The shaping into one list
 * happens in the service — this layer only fetches.
 *
 * Which client is passed in matters. The app passes a USER-scoped client so
 * existing RLS decides what a given teammate may see — that is how the Vault
 * inherits the `finance` and `contracts` capabilities without restating them.
 * The portal passes a service-role client and fences on contact_id itself,
 * exactly as every other portal read does.
 */

const COLS =
  'id, owner_id, uploaded_by, title, description, category, file_name, file_url, public_id, ' +
  'file_size, file_type, resource_type, visibility, contact_id, created_at, updated_at'

// ── Uploaded items ──────────────────────────────────────────────────────────

export async function listItems(db: SupabaseClient, ownerId: string): Promise<VaultItem[]> {
  const { data, error } = await db
    .from('vault_items')
    .select(COLS)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as VaultItem[]
}

/**
 * What one portal client may see: anything shared with them by name, plus
 * anything shared with every client.
 *
 * The `or` group is self-contained and AND-ed with owner_id, so it can widen
 * the visibility test but never escape the workspace.
 */
export async function listItemsForContact(
  db: SupabaseClient,
  ownerId: string,
  contactId: string,
): Promise<VaultItem[]> {
  const { data, error } = await db
    .from('vault_items')
    .select(COLS)
    .eq('owner_id', ownerId)
    .or(`and(visibility.eq.client,contact_id.eq.${contactId}),visibility.eq.all_clients`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as VaultItem[]
}

export async function getItem(db: SupabaseClient, id: string): Promise<VaultItem | null> {
  const { data, error } = await db
    .from('vault_items')
    .select(COLS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as VaultItem | null) ?? null
}

export async function insertItem(
  db: SupabaseClient,
  ownerId: string,
  uploadedBy: string,
  payload: CreateVaultItemPayload,
): Promise<VaultItem> {
  const { data, error } = await db
    .from('vault_items')
    .insert({
      owner_id:      ownerId,
      uploaded_by:   uploadedBy,
      title:         payload.title,
      description:   payload.description ?? null,
      category:      payload.category,
      file_name:     payload.file_name,
      file_url:      payload.file_url,
      public_id:     payload.public_id,
      file_size:     payload.file_size ?? null,
      file_type:     payload.file_type ?? null,
      resource_type: payload.resource_type,
      visibility:    payload.visibility,
      contact_id:    payload.contact_id ?? null,
    })
    .select(COLS)
    .single()
  if (error) throw error
  return data as unknown as VaultItem
}

export async function updateItem(
  db: SupabaseClient,
  id: string,
  patch: UpdateVaultItemPayload,
): Promise<VaultItem> {
  const { data, error } = await db
    .from('vault_items')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLS)
    .single()
  if (error) throw error
  return data as unknown as VaultItem
}

export async function deleteItem(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('vault_items').delete().eq('id', id)
  if (error) throw error
}

// ── Notes ───────────────────────────────────────────────────────────────────

const NOTE_COLS =
  'id, owner_id, created_by, title, body, category, visibility, contact_id, created_at, updated_at'

export async function listNotes(db: SupabaseClient, ownerId: string): Promise<VaultNote[]> {
  const { data, error } = await db
    .from('vault_notes')
    .select(NOTE_COLS)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as VaultNote[]
}

/** Same visibility fence as uploaded items — see `listItemsForContact`. */
export async function listNotesForContact(
  db: SupabaseClient,
  ownerId: string,
  contactId: string,
): Promise<VaultNote[]> {
  const { data, error } = await db
    .from('vault_notes')
    .select(NOTE_COLS)
    .eq('owner_id', ownerId)
    .or(`and(visibility.eq.client,contact_id.eq.${contactId}),visibility.eq.all_clients`)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as VaultNote[]
}

export async function getNote(db: SupabaseClient, id: string): Promise<VaultNote | null> {
  const { data, error } = await db
    .from('vault_notes')
    .select(NOTE_COLS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as VaultNote | null) ?? null
}

export async function insertNote(
  db: SupabaseClient,
  ownerId: string,
  createdBy: string,
  payload: CreateVaultNotePayload,
): Promise<VaultNote> {
  const { data, error } = await db
    .from('vault_notes')
    .insert({
      owner_id:   ownerId,
      created_by: createdBy,
      title:      payload.title,
      body:       payload.body,
      category:   payload.category,
      visibility: payload.visibility,
      contact_id: payload.contact_id ?? null,
    })
    .select(NOTE_COLS)
    .single()
  if (error) throw error
  return data as unknown as VaultNote
}

export async function updateNote(
  db: SupabaseClient,
  id: string,
  patch: UpdateVaultNotePayload,
): Promise<VaultNote> {
  const { data, error } = await db
    .from('vault_notes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(NOTE_COLS)
    .single()
  if (error) throw error
  return data as unknown as VaultNote
}

export async function deleteNote(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('vault_notes').delete().eq('id', id)
  if (error) throw error
}

// ── Borrowed rows ───────────────────────────────────────────────────────────
// Read-only. The Vault lists these; it never edits or deletes them, because
// their real home is the invoice builder and the contracts page.

export interface VaultInvoiceRow {
  id: string
  invoice_number: string | null
  status: string
  totals: { total?: number } | null
  currency: string | null
  crm_contact_id: string | null
  share_token: string | null
  created_at: string
}

/**
 * Drafts are excluded. A draft invoice is a work in progress, not a document
 * anyone needs to find later, and surfacing them would bury the real ones.
 */
export async function listInvoices(
  db: SupabaseClient,
  ownerId: string,
  contactId?: string,
): Promise<VaultInvoiceRow[]> {
  let q = db
    .from('invoices')
    .select('id, invoice_number, status, totals, currency, crm_contact_id, share_token, created_at')
    .eq('user_id', ownerId)
    .in('status', ['sent', 'viewed', 'paid', 'overdue'])
  if (contactId) q = q.eq('crm_contact_id', contactId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as VaultInvoiceRow[]
}

export interface VaultContractRow {
  id: string
  title: string
  status: string
  contact_id: string
  share_token: string | null
  signed_at: string | null
  created_at: string
}

/** Drafts excluded for the same reason as invoices. */
export async function listContracts(
  db: SupabaseClient,
  ownerId: string,
  contactId?: string,
): Promise<VaultContractRow[]> {
  let q = db
    .from('crm_contracts')
    .select('id, title, status, contact_id, share_token, signed_at, created_at')
    .eq('owner_id', ownerId)
    .in('status', ['sent', 'signed', 'declined'])
  if (contactId) q = q.eq('contact_id', contactId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as VaultContractRow[]
}

/** Names for the client column. One read rather than a join per row. */
export async function contactNames(
  db: SupabaseClient,
  ownerId: string,
): Promise<Map<string, string>> {
  const { data, error } = await db
    .from('crm_contacts')
    .select('id, name')
    .eq('owner_id', ownerId)
  if (error) throw error
  return new Map(((data ?? []) as unknown as { id: string; name: string }[]).map((c) => [c.id, c.name]))
}
