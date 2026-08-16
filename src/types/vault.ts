// Agency Vault — the agency's documents in one place, on both sides of the portal.

/**
 * What a Vault entry actually is.
 *
 * `file` is a row in `vault_items` and `note` is a row in `vault_notes` — both
 * belong to the Vault and can be edited from it. Invoices and contracts are
 * read from their own tables at request time and shaped into the same envelope,
 * so the Vault can list them beside its own without ever holding a second copy
 * that could fall out of date.
 */
export type VaultEntryKind = 'file' | 'note' | 'invoice' | 'contract'

export const VAULT_CATEGORIES = ['legal', 'finance', 'brand', 'admin', 'insurance', 'other'] as const
export type VaultCategory = (typeof VAULT_CATEGORIES)[number]

export const VAULT_CATEGORY_LABEL: Record<VaultCategory, string> = {
  legal:     'Legal',
  finance:   'Finance',
  brand:     'Brand',
  admin:     'Admin',
  insurance: 'Insurance',
  other:     'Other',
}

export const VAULT_VISIBILITIES = ['private', 'client', 'all_clients'] as const
export type VaultVisibility = (typeof VAULT_VISIBILITIES)[number]

export const VAULT_VISIBILITY_LABEL: Record<VaultVisibility, string> = {
  private:     'Only your team',
  client:      'One client',
  all_clients: 'All clients',
}

export const VAULT_VISIBILITY_DESCRIPTION: Record<VaultVisibility, string> = {
  private:     'Nobody outside your workspace can see this.',
  client:      'Appears in that client’s portal, and nobody else’s.',
  all_clients: 'Appears in every client’s portal. Good for terms or brand guidelines.',
}

/** An uploaded document — one row in `vault_items`. */
export interface VaultItem {
  id:            string
  owner_id:      string
  uploaded_by:   string | null
  title:         string
  description:   string | null
  category:      VaultCategory
  file_name:     string
  file_url:      string
  public_id:     string
  file_size:     number | null
  file_type:     string | null
  resource_type: 'image' | 'video' | 'raw'
  visibility:    VaultVisibility
  /** Set only when visibility is 'client'. */
  contact_id:    string | null
  created_at:    string
  updated_at:    string
}

/** A note written in Fey — one row in `vault_notes`. */
export interface VaultNote {
  id:         string
  owner_id:   string
  created_by: string | null
  title:      string
  /** Plain text with a small Markdown subset. Never HTML. */
  body:       string
  category:   VaultCategory
  visibility: VaultVisibility
  /** Set only when visibility is 'client'. */
  contact_id: string | null
  created_at: string
  updated_at: string
}

/**
 * One line in the Vault, whatever it came from.
 *
 * `kind` decides which of the trailing fields carry anything, and — more
 * importantly — what may be done with it: only a `file` or a `note` can be
 * renamed, reshared or deleted from here. An invoice's home is still the
 * invoice builder, and the Vault will not pretend otherwise.
 */
export interface VaultEntry {
  kind:        VaultEntryKind
  /** The underlying row id — a vault_items, vault_notes, invoices or crm_contracts id. */
  id:          string
  title:       string
  /** Free-text line under the title: a client name, an amount, a status. */
  subtitle:    string | null
  category:    VaultCategory
  created_at:  string
  /** Where the document can be opened. Null for notes, which open in place. */
  href:        string | null
  /** Which client this belongs to, when it belongs to one. */
  contact_id:   string | null
  contact_name: string | null

  // Uploaded files only.
  file_name:     string | null
  file_size:     number | null
  file_type:     string | null
  resource_type: 'image' | 'video' | 'raw' | null
  description:   string | null

  // Files and notes.
  visibility:    VaultVisibility | null

  // Notes only. The body travels with the list so opening a note is instant —
  // affordable because bodies are capped at 20k characters in the database.
  body:          string | null
  updated_at:    string | null
}

/** Everything the Vault needs to create an entry, once the file is uploaded. */
export interface CreateVaultItemPayload {
  title:         string
  description?:  string | null
  category:      VaultCategory
  file_name:     string
  file_url:      string
  public_id:     string
  file_size?:    number | null
  file_type?:    string | null
  resource_type: 'image' | 'video' | 'raw'
  visibility:    VaultVisibility
  contact_id?:   string | null
}

/** Everything needed to write a new note. */
export interface CreateVaultNotePayload {
  title:       string
  body:        string
  category:    VaultCategory
  visibility:  VaultVisibility
  contact_id?: string | null
}

/** Editing a note. Every field optional — ticking one checkbox sends only `body`. */
export interface UpdateVaultNotePayload {
  title?:      string
  body?:       string
  category?:   VaultCategory
  visibility?: VaultVisibility
  contact_id?: string | null
}

/** Renaming, recategorising or resharing an existing item. */
export interface UpdateVaultItemPayload {
  title?:       string
  description?: string | null
  category?:    VaultCategory
  visibility?:  VaultVisibility
  contact_id?:  string | null
}

/** Narrowing the list. All optional; omitted means "everything". */
export interface VaultFilter {
  kind?:       VaultEntryKind | 'all'
  category?:   VaultCategory | 'all'
  contact_id?: string | null
  /** Matched against title, description and file name. */
  search?:     string
}

/**
 * Only what the Vault owns can be changed from inside it.
 *
 * Invoices and contracts are listed here but live elsewhere, and a rename or
 * delete button on them would promise something the Vault shouldn't keep.
 */
export function isEditable(entry: VaultEntry): boolean {
  return entry.kind === 'file' || entry.kind === 'note'
}

/** A one-line preview of a note, for the row under its title. */
export function noteExcerpt(body: string, max = 90): string | null {
  const flat = body
    // Strip the markers so the preview reads as a sentence rather than syntax.
    .replace(/^\s*(#{1,3}\s+|[-*]\s+\[[ xX]\]\s*|[-*]\s+|>\s+|\d+\.\s+)/gm, '')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return null
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat
}
