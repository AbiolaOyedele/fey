-- ════════════════════════════════════════════════════════════════════════════
-- Portal: client-created tasks, team access control, invited members
-- Date: 2026-08-04
--
-- Three related changes, all driven by the same shift: the portal stops being
-- read-only for clients.
--
--   1. client_team_access — which of the agency's people a given client may see
--      and assign work to. Deliberately opt-in: with no rows, a client sees
--      nobody, so enabling portal access can never leak the whole team roster.
--
--   2. work_tasks.requested_by_portal_user — portal users are NOT auth users, so
--      they cannot satisfy work_tasks.created_by (FK → auth.users). A
--      client-created task is attributed to the workspace owner in created_by
--      and records the real requester here, which is what the UI shows.
--
--   3. portal_users invite columns + nullable password_hash — a client_admin can
--      add a colleague before that person has ever signed in. The row exists
--      with no password; login already fails safely against a dummy hash, and
--      signup claims the row instead of rejecting the email as taken.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. client_team_access ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_team_access (
  contact_id UUID        NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  -- Denormalised so RLS can authorise without joining crm_contacts.
  owner_id   UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_team_access_contact ON client_team_access (contact_id);
CREATE INDEX IF NOT EXISTS idx_client_team_access_user    ON client_team_access (user_id);

ALTER TABLE client_team_access ENABLE ROW LEVEL SECURITY;

-- Anyone in the workspace can see who a client is allowed to reach; only
-- managers can change it. The portal reads this through the service role.
DROP POLICY IF EXISTS client_team_access_select ON client_team_access;
CREATE POLICY client_team_access_select ON client_team_access FOR SELECT
  USING (app_can_access_owner(owner_id));

DROP POLICY IF EXISTS client_team_access_insert ON client_team_access;
CREATE POLICY client_team_access_insert ON client_team_access FOR INSERT
  WITH CHECK (app_can_manage_owner(owner_id));

DROP POLICY IF EXISTS client_team_access_delete ON client_team_access;
CREATE POLICY client_team_access_delete ON client_team_access FOR DELETE
  USING (app_can_manage_owner(owner_id));

-- ── 2. work_tasks: who actually asked for this ──────────────────────────────
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS requested_by_portal_user UUID REFERENCES portal_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_tasks_requested_by
  ON work_tasks (requested_by_portal_user)
  WHERE requested_by_portal_user IS NOT NULL;

COMMENT ON COLUMN work_tasks.requested_by_portal_user IS
  'Set when a client raised this task from their portal. created_by stays the workspace owner because portal users are not auth users.';

-- ── 3. portal_users: invited-but-not-yet-joined members ─────────────────────
ALTER TABLE portal_users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

COMMENT ON COLUMN portal_users.password_hash IS
  'NULL for an invited member who has not set a password yet. Login compares against a dummy hash, so a NULL-password row can never authenticate.';
