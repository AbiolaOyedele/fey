-- ════════════════════════════════════════════════════════════════════════════
-- Team Workspaces — Phase 2: shared access to existing data (role-gated)
-- Date: 2026-06-13
--
-- Extends the per-owner CRM/business tables so every member of a workspace can
-- access that workspace's data, gated by role:
--   • SELECT / INSERT / UPDATE  → any member
--   • DELETE                    → owner/admin only
--
-- SAFE BY CONSTRUCTION: the original "owner_id = auth.uid()" policies are left
-- in place. Postgres OR's permissive policies, so this migration only ADDS
-- co-member access — existing owners' behavior is unchanged. And because each
-- workspace currently has just its owner as a member, these policies grant
-- nothing new until an invite is accepted.
-- ════════════════════════════════════════════════════════════════════════════

-- A row owned by `target_owner` belongs to the workspace where
-- workspaces.owner_id = target_owner. The caller may access it if they're a
-- member of that workspace. (SECURITY DEFINER: bypasses RLS, no recursion.)
CREATE OR REPLACE FUNCTION app_can_access_owner(target_owner UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE w.owner_id = target_owner
      AND m.user_id = auth.uid()
  );
$$;

-- Same, but only true for owner/admin — used to gate destructive actions.
CREATE OR REPLACE FUNCTION app_can_manage_owner(target_owner UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE w.owner_id = target_owner
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  );
$$;

-- ── owner_id-keyed tables ──────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_contacts', 'crm_messages', 'crm_files',
    'crm_contracts', 'crm_forms', 'crm_payment_requests'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS member_select ON %I', t);
    EXECUTE format('CREATE POLICY member_select ON %I FOR SELECT USING (app_can_access_owner(owner_id))', t);

    EXECUTE format('DROP POLICY IF EXISTS member_insert ON %I', t);
    EXECUTE format('CREATE POLICY member_insert ON %I FOR INSERT WITH CHECK (app_can_access_owner(owner_id))', t);

    EXECUTE format('DROP POLICY IF EXISTS member_update ON %I', t);
    EXECUTE format('CREATE POLICY member_update ON %I FOR UPDATE USING (app_can_access_owner(owner_id)) WITH CHECK (app_can_access_owner(owner_id))', t);

    EXECUTE format('DROP POLICY IF EXISTS member_delete ON %I', t);
    EXECUTE format('CREATE POLICY member_delete ON %I FOR DELETE USING (app_can_manage_owner(owner_id))', t);
  END LOOP;
END $$;

-- ── user_id-keyed tables (invoices, crm_templates) ─────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices', 'crm_templates'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS member_select ON %I', t);
    EXECUTE format('CREATE POLICY member_select ON %I FOR SELECT USING (app_can_access_owner(user_id))', t);

    EXECUTE format('DROP POLICY IF EXISTS member_insert ON %I', t);
    EXECUTE format('CREATE POLICY member_insert ON %I FOR INSERT WITH CHECK (app_can_access_owner(user_id))', t);

    EXECUTE format('DROP POLICY IF EXISTS member_update ON %I', t);
    EXECUTE format('CREATE POLICY member_update ON %I FOR UPDATE USING (app_can_access_owner(user_id)) WITH CHECK (app_can_access_owner(user_id))', t);

    EXECUTE format('DROP POLICY IF EXISTS member_delete ON %I', t);
    EXECUTE format('CREATE POLICY member_delete ON %I FOR DELETE USING (app_can_manage_owner(user_id))', t);
  END LOOP;
END $$;
