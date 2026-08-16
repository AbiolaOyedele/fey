-- ════════════════════════════════════════════════════════════════════════════
-- Vault notes — documents written in Fey rather than uploaded to it
-- Date: 2026-08-16
--
-- A separate table from `vault_items` on purpose. A vault item is a pointer to
-- a file in Cloudinary — file_name, file_url, public_id and resource_type are
-- all NOT NULL, and rightly so, because an item without them is a broken
-- download. A note has none of those and never will. Widening `vault_items`
-- to hold both would mean every one of those columns becomes nullable and the
-- guarantee that an uploaded file actually exists is lost for all rows.
--
-- Everything else is deliberately identical: the same categories, the same
-- three visibilities, the same contact pairing rule, the same RLS. The Vault
-- shapes both into one list at read time, exactly as it already does for
-- invoices and contracts.
--
-- The body is plain text holding a small subset of Markdown — headings, lists,
-- checkboxes, emphasis. Stored as written, never as HTML, so nothing that
-- arrives here can become markup on the way back out.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vault_notes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  title         TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  -- Capped because the whole note travels with the list. 20k characters is
  -- roughly 4,000 words — far beyond what anyone writes into a filing cabinet,
  -- and small enough that a workspace full of them still loads in one request.
  body          TEXT        NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),

  category      TEXT        NOT NULL DEFAULT 'other'
    CHECK (category IN ('legal', 'finance', 'brand', 'admin', 'insurance', 'other')),

  visibility    TEXT        NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'client', 'all_clients')),
  contact_id    UUID        REFERENCES crm_contacts(id) ON DELETE CASCADE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same rule as vault_items, for the same reason: a 'client' note with no
  -- contact is visible to nobody, and a private note still carrying a stale
  -- contact_id is how one client's name ends up in another client's view.
  CONSTRAINT vault_notes_visibility_contact CHECK (
    (visibility = 'client'  AND contact_id IS NOT NULL) OR
    (visibility <> 'client' AND contact_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_notes_owner
  ON vault_notes (owner_id, updated_at DESC);

-- The portal's query: notes shared with one contact, plus notes shared with
-- every contact. Partial, because private notes are the majority and are never
-- fetched this way.
CREATE INDEX IF NOT EXISTS idx_vault_notes_shared
  ON vault_notes (owner_id, contact_id)
  WHERE visibility IN ('client', 'all_clients');

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Identical to vault_items: any workspace member may read, only owner /
-- super_admin / admin may write. Portal clients never reach this table through
-- RLS — their route runs service-role and fences on contact_id itself.

ALTER TABLE vault_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vault_notes_select" ON vault_notes;
CREATE POLICY "vault_notes_select" ON vault_notes
  FOR SELECT USING (app_can_access_owner(owner_id));

DROP POLICY IF EXISTS "vault_notes_insert" ON vault_notes;
CREATE POLICY "vault_notes_insert" ON vault_notes
  FOR INSERT WITH CHECK (app_can_manage_owner(owner_id));

DROP POLICY IF EXISTS "vault_notes_update" ON vault_notes;
CREATE POLICY "vault_notes_update" ON vault_notes
  FOR UPDATE USING (app_can_manage_owner(owner_id))
  WITH CHECK (app_can_manage_owner(owner_id));

DROP POLICY IF EXISTS "vault_notes_delete" ON vault_notes;
CREATE POLICY "vault_notes_delete" ON vault_notes
  FOR DELETE USING (app_can_manage_owner(owner_id));

COMMENT ON TABLE vault_notes IS
  'Documents written inside Fey — notes, checklists, process write-ups. Kept apart from vault_items because a note has no stored file, and making the file columns nullable would weaken every uploaded row.';

COMMENT ON COLUMN vault_notes.body IS
  'Plain text with a small Markdown subset (#, -, - [ ], **, *, `, >). Stored verbatim and rendered as React nodes, never as HTML.';
