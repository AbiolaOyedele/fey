-- ════════════════════════════════════════════════════════════════════════════
-- Archive support for clients (and projects, once that table exists)
-- Date: 2026-06-15
--
-- Archiving hides an entity from default views without deleting it. A non-null
-- archived_at means "archived". Reversible by setting it back to NULL.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS crm_contacts_archived_idx
  ON crm_contacts (archived_at);

-- Projects archive column is added in the projects migration (it ships with an
-- archived_at column from the start), so nothing to do here for projects.
