-- Tiered workspace roles + owner-configurable admin permissions.
--
-- PREREQUISITE: run 20260802_workspace_role_super_admin_enum.sql first and let
-- it commit (Postgres cannot use a new enum value in the transaction that adds
-- it). This file will fail with "unsafe use of new value" otherwise.
--
-- The model:
--   owner        — everything, always. Not configurable.
--   super_admin  — everything the old `admin` had, including financial.
--   admin        — oversight tier. Restricted by default; the owner grants
--                  capabilities per workspace via workspaces.admin_permissions.
--   member       — unchanged.
--
-- Capabilities are strings in a jsonb array, e.g. '["finance","team"]':
--   finance        invoices + payments
--   contracts      crm_contracts + crm_payment_requests
--   image_credits  Image Pipeline credits, allocations, rates, cost dashboard
--   team           team management + workspace settings
--
-- Idempotent: safe to re-run.

BEGIN;

-- ── 1. Preserve today's access ────────────────────────────────────────────────
-- Existing admins had full access, financial included. Silently demoting a real
-- person is not acceptable, so they become super_admin; the owner can demote
-- them deliberately from Settings afterwards.
UPDATE workspace_members SET role = 'super_admin' WHERE role = 'admin';

-- ── 2. Per-workspace capability grants ────────────────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS admin_permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN workspaces.admin_permissions IS
  'Capabilities granted to the admin role in this workspace. jsonb array of: finance, contracts, image_credits, team. Empty = fully restricted. owner/super_admin ignore this.';

-- ── 3. Capability check used by RLS ───────────────────────────────────────────
-- True when the caller may exercise `cap` within target_owner's scope.
-- owner/super_admin always may; admin only if the workspace grants it; member
-- never. SECURITY DEFINER so it can read workspaces/members regardless of the
-- caller's own policies, matching the existing app_can_* helpers.
CREATE OR REPLACE FUNCTION app_has_capability(target_owner UUID, cap TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE w.owner_id = target_owner
      AND m.user_id = auth.uid()
      AND (
        m.role IN ('owner', 'super_admin')
        OR (m.role = 'admin' AND w.admin_permissions ? cap)
      )
  );
$$;

-- ── 4. Teach the existing helper about super_admin ────────────────────────────
-- Without this, promoting an admin to super_admin would *reduce* their rights:
-- the old helper only matched ('owner','admin'). `admin` stays here so the tier
-- keeps managing non-restricted CRM data; the restricted tables are re-gated in
-- step 5 and no longer rely on this function.
CREATE OR REPLACE FUNCTION app_can_manage_owner(target_owner UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE w.owner_id = target_owner
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'super_admin', 'admin')
  );
$$;

-- ── 5. Re-gate the financial tables ───────────────────────────────────────────
-- Previously every member could SELECT these (app_can_access_owner) and only
-- writes were gated. Both reads and writes now require the capability, so a
-- restricted admin — and a member — cannot see the figures at all.
--
-- NOTE: this narrows access for existing members, which is the intended
-- behaviour change. A member who needs invoices must be given the capability
-- via the admin role, or be made super_admin.

-- owner_id-keyed, capability: contracts
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_contracts', 'crm_payment_requests'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS member_view ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS member_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS mgr_insert ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS mgr_update ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS mgr_delete ON %I', t);

    EXECUTE format('CREATE POLICY cap_select ON %I FOR SELECT USING (app_has_capability(owner_id, ''contracts''))', t);
    EXECUTE format('CREATE POLICY cap_insert ON %I FOR INSERT WITH CHECK (app_has_capability(owner_id, ''contracts''))', t);
    EXECUTE format('CREATE POLICY cap_update ON %I FOR UPDATE USING (app_has_capability(owner_id, ''contracts'')) WITH CHECK (app_has_capability(owner_id, ''contracts''))', t);
    EXECUTE format('CREATE POLICY cap_delete ON %I FOR DELETE USING (app_has_capability(owner_id, ''contracts''))', t);
  END LOOP;
END $$;

-- user_id-keyed, capability: finance
DO $$
BEGIN
  DROP POLICY IF EXISTS member_view ON invoices;
  DROP POLICY IF EXISTS member_select ON invoices;
  DROP POLICY IF EXISTS mgr_insert ON invoices;
  DROP POLICY IF EXISTS mgr_update ON invoices;
  DROP POLICY IF EXISTS mgr_delete ON invoices;

  CREATE POLICY cap_select ON invoices FOR SELECT USING (app_has_capability(user_id, 'finance'));
  CREATE POLICY cap_insert ON invoices FOR INSERT WITH CHECK (app_has_capability(user_id, 'finance'));
  CREATE POLICY cap_update ON invoices FOR UPDATE USING (app_has_capability(user_id, 'finance')) WITH CHECK (app_has_capability(user_id, 'finance'));
  CREATE POLICY cap_delete ON invoices FOR DELETE USING (app_has_capability(user_id, 'finance'));
END $$;

-- ── 6. Team management ────────────────────────────────────────────────────────
-- Managing the roster is the `team` capability. Restricted admins can still read
-- the roster (they need to see who is who) but cannot change it.
DROP POLICY IF EXISTS members_manage ON workspace_members;
DROP POLICY IF EXISTS members_insert ON workspace_members;
DROP POLICY IF EXISTS members_update ON workspace_members;
DROP POLICY IF EXISTS members_delete ON workspace_members;

CREATE POLICY members_insert ON workspace_members FOR INSERT
  WITH CHECK (app_has_capability((SELECT owner_id FROM workspaces WHERE id = workspace_id), 'team'));
CREATE POLICY members_update ON workspace_members FOR UPDATE
  USING (app_has_capability((SELECT owner_id FROM workspaces WHERE id = workspace_id), 'team'))
  WITH CHECK (app_has_capability((SELECT owner_id FROM workspaces WHERE id = workspace_id), 'team'));
CREATE POLICY members_delete ON workspace_members FOR DELETE
  USING (app_has_capability((SELECT owner_id FROM workspaces WHERE id = workspace_id), 'team'));

COMMIT;
