// Agency Vault — the agency's documents in one place, on both sides of the portal.

/**
 * What a Vault entry actually is.
 *
 * Only `file` is a row in `vault_items`. Invoices and contracts are read from
 * their own tables at request time and shaped into the same envelope, so the
 * Vault can list them beside uploads without ever holding a second copy that
 * could fall out of date.
 */
export type VaultEntryKind = 'file' | 'invoice' | 'contract'

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

/**
 * One line in the Vault, whatever it came from.
 *
 * `kind` decides which of the trailing fields carry anything, and — more
 * importantly — what may be done with it: only a `file` can be renamed,
 * reshared or deleted from here. An invoice's home is still the invoice
 * builder, and the Vault will not pretend otherwise.
 */
export interface VaultEntry {
  kind:        VaultEntryKind
  /** The underlying row id — a vault_items, invoices or crm_contracts id. */
  id:          string
  title:       string
  /** Free-text line under the title: a client name, an amount, a status. */
  subtitle:    string | null
  category:    VaultCategory
  created_at:  string
  /** Where the document can be opened. Null when there's nothing to open yet. */
  href:        string | null
  /** Which client this belongs to, when it belongs to one. */
  contact_id:   string | null
  contact_name: string | null

  // Uploaded files only.
  file_name:     string | null
  file_size:     number | null
  file_type:     string | null
  resource_type: 'image' | 'video' | 'raw' | null
  visibility:    VaultVisibility | null
  description:   string | null
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

/** Only uploaded files can be changed from inside the Vault. */
export function isEditable(entry: VaultEntry): boolean {
  return entry.kind === 'file'
}
