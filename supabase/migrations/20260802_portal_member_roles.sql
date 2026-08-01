-- ════════════════════════════════════════════════════════════════════════════
-- Client Portal — member roles
-- Date: 2026-08-02
--
-- Additive and idempotent. Safe to re-run.
--
-- A contact can already have several portal users (see portal_users.contact_id).
-- Until now they were all equal. This gives each one a role, so a client can
-- decide who on their side may sign a contract or pay an invoice, and the owner
-- can see and override that from the CRM.
--
-- Roles, narrowest last:
--   client_admin  — the client's own lead. Manages their members' roles, and
--                   can do everything a collaborator can.
--   collaborator  — full day-to-day use: messages, files, forms, tasks.
--   viewer        — read-only. Sees the portal, changes nothing.
--
-- Signing and paying are deliberately NOT a role of their own: they're
-- capability flags, because "who may sign" rarely lines up with seniority.
-- Both default TRUE for client_admin and FALSE otherwise, set by the backfill
-- below, and either side can change them afterwards.
--
-- The FIRST portal user for a contact becomes client_admin; everyone else
-- becomes a collaborator. That preserves today's behaviour for existing users
-- (nobody loses access) while giving each contact someone who can manage roles.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Role + capability columns ────────────────────────────────────────────

ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS role      TEXT    NOT NULL DEFAULT 'collaborator',
  ADD COLUMN IF NOT EXISTS can_sign  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_pay   BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE portal_users DROP CONSTRAINT IF EXISTS portal_users_role_check;
ALTER TABLE portal_users
  ADD CONSTRAINT portal_users_role_check
  CHECK (role IN ('client_admin', 'collaborator', 'viewer'));

CREATE INDEX IF NOT EXISTS idx_portal_users_contact_role
  ON portal_users (contact_id, role);

-- ── 2. Backfill ─────────────────────────────────────────────────────────────
-- Oldest portal user per contact becomes that contact's admin, with signing and
-- paying enabled. Guarded on "no admin yet" so re-running never demotes anyone
-- or overrides a role set by hand afterwards.

WITH first_per_contact AS (
  SELECT DISTINCT ON (contact_id) id, contact_id
  FROM portal_users
  ORDER BY contact_id, created_at ASC NULLS LAST, id
)
UPDATE portal_users pu
   SET role     = 'client_admin',
       can_sign = TRUE,
       can_pay  = TRUE
  FROM first_per_contact f
 WHERE pu.id = f.id
   AND NOT EXISTS (
     SELECT 1 FROM portal_users other
      WHERE other.contact_id = pu.contact_id
        AND other.role = 'client_admin'
   );

-- Everyone who was already using the portal keeps working: collaborator is the
-- column default, and the existing single-user case is now an admin.

COMMENT ON COLUMN portal_users.role IS
  'client_admin | collaborator | viewer — who this person is on the CLIENT side. Unrelated to workspace_members.role, which is the agency side.';
COMMENT ON COLUMN portal_users.can_sign IS
  'May sign contracts. A capability, not a role — seniority and signing authority often differ.';
COMMENT ON COLUMN portal_users.can_pay IS
  'May settle invoices and payment requests.';
