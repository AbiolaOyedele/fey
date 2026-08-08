-- ════════════════════════════════════════════════════════════════════════════
-- Agency Vault — one place for the documents an agency actually needs to find
-- Date: 2026-08-08
--
-- Only uploaded documents live here. Invoices and contracts are NOT copied in:
-- they already exist in `invoices` and `crm_contracts`, and duplicating them
-- would mean two records that drift the moment one is edited. The Vault
-- assembles them at read time instead, so a paid invoice reads as paid in the
-- Vault the second it's paid anywhere else.
--
-- That also means the Vault inherits its permissions for free. Invoices are
-- read through the caller's own client, so the `finance` capability still
-- decides who sees figures; contracts likewise through `contracts`. A member
-- who can't see invoices doesn't see them here either, and nothing had to be
-- re-implemented to make that true.
--
-- Visibility, for uploaded items only:
--   private      — the agency alone. The default, and the safe one.
--   client       — one named client, in their portal. Requires contact_id.
--   all_clients  — every client with a portal sees it (terms, brand guides,
--                  a rate card). No contact_id: it isn't about one client.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vault_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  title         TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description   TEXT        CHECK (description IS NULL OR char_length(description) <= 2000),
  -- A flat, fixed set rather than free-form folders. Agencies file the same
  -- handful of things, and a fixed set stays searchable and translatable in a
  -- way a folder tree the user invents does not.
  category      TEXT        NOT NULL DEFAULT 'other'
    CHECK (category IN ('legal', 'finance', 'brand', 'admin', 'insurance', 'other')),

  -- The asset itself, in Cloudinary — same arrangement as crm_files.
  file_name     TEXT        NOT NULL,
  file_url      TEXT        NOT NULL,
  public_id     TEXT        NOT NULL,
  file_size     BIGINT,
  file_type     TEXT,
  -- Needed to delete the asset later: Cloudinary requires the resource type it
  -- was uploaded under, and it can't be inferred reliably from the URL.
  resource_type TEXT        NOT NULL DEFAULT 'raw'
    CHECK (resource_type IN ('image', 'video', 'raw')),

  visibility    TEXT        NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'client', 'all_clients')),
  contact_id    UUID        REFERENCES crm_contacts(id) ON DELETE CASCADE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enforced here rather than only in the service: a 'client' item with no
  -- contact would be invisible to everyone, and a shared item carrying a stale
  -- contact_id is how one client ends up seeing another's name.
  CONSTRAINT vault_items_visibility_contact CHECK (
    (visibility = 'client'  AND contact_id IS NOT NULL) OR
    (visibility <> 'client' AND contact_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_items_owner
  ON vault_items (owner_id, created_at DESC);

-- The portal's query: everything shared with one contact, plus everything
-- shared with all of them. Partial, because private items are the majority and
-- are never fetched this way.
CREATE INDEX IF NOT EXISTS idx_vault_items_shared
  ON vault_items (owner_id, contact_id)
  WHERE visibility IN ('client', 'all_clients');

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Standard owner-keyed pattern: any workspace member may read, only owner /
-- super_admin / admin may write. Portal clients don't reach this table through
-- RLS at all — their route runs service-role and fences on contact_id itself,
-- as every other portal read does.

ALTER TABLE vault_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vault_items_select" ON vault_items;
CREATE POLICY "vault_items_select" ON vault_items
  FOR SELECT USING (app_can_access_owner(owner_id));

DROP POLICY IF EXISTS "vault_items_insert" ON vault_items;
CREATE POLICY "vault_items_insert" ON vault_items
  FOR INSERT WITH CHECK (app_can_manage_owner(owner_id));

DROP POLICY IF EXISTS "vault_items_update" ON vault_items;
CREATE POLICY "vault_items_update" ON vault_items
  FOR UPDATE USING (app_can_manage_owner(owner_id))
  WITH CHECK (app_can_manage_owner(owner_id));

DROP POLICY IF EXISTS "vault_items_delete" ON vault_items;
CREATE POLICY "vault_items_delete" ON vault_items
  FOR DELETE USING (app_can_manage_owner(owner_id));

COMMENT ON TABLE vault_items IS
  'Documents an agency uploads to keep in one place. Invoices and contracts are deliberately absent — the Vault reads those from their own tables at request time so the two can never disagree.';

COMMENT ON COLUMN vault_items.visibility IS
  'private = agency only (default). client = one contact, shown in their portal, requires contact_id. all_clients = shown in every portal, contact_id must be null.';
