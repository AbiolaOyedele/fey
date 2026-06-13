-- ════════════════════════════════════════════════════════════════════════════
-- Team Workspaces — Phase 2 (v2): role-scoped permissions
-- Date: 2026-06-13
--
-- Refines the Phase 2 access model so members get LEAST privilege:
--
--   Resource                                  member            admin/owner
--   ───────────────────────────────────────   ───────────────   ───────────
--   crm_messages (client chat)                view + send        full
--   crm_files                                 view + upload      full (+delete)
--   crm_contacts / contracts / forms /
--   payment_requests / invoices / templates   view only          full
--
-- Owner access is still covered by the original "owner_id = auth.uid()" (or
-- "user_id = auth.uid()") policies, left intact. These policies only ADD scoped
-- member/admin access. Safe to run whether or not the first Phase 2 file ran —
-- every policy is dropped-if-exists first.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop any policies from the earlier (overly-permissive) Phase 2 file.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_contacts','crm_messages','crm_files','crm_contracts','crm_forms',
    'crm_payment_requests','invoices','crm_templates'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS member_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS member_insert ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS member_update ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS member_delete ON %I', t);
    -- v2 names (idempotent re-runs)
    EXECUTE format('DROP POLICY IF EXISTS member_view   ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS member_write  ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS member_modify ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS mgr_insert    ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS mgr_update    ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS mgr_delete    ON %I', t);
  END LOOP;
END $$;

-- ── View-only for members; full for admin/owner (owner_id-keyed) ───────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_contacts','crm_contracts','crm_forms','crm_payment_requests'
  ] LOOP
    EXECUTE format('CREATE POLICY member_view ON %I FOR SELECT USING (app_can_access_owner(owner_id))', t);
    EXECUTE format('CREATE POLICY mgr_insert  ON %I FOR INSERT WITH CHECK (app_can_manage_owner(owner_id))', t);
    EXECUTE format('CREATE POLICY mgr_update  ON %I FOR UPDATE USING (app_can_manage_owner(owner_id)) WITH CHECK (app_can_manage_owner(owner_id))', t);
    EXECUTE format('CREATE POLICY mgr_delete  ON %I FOR DELETE USING (app_can_manage_owner(owner_id))', t);
  END LOOP;
END $$;

-- ── View-only for members; full for admin/owner (user_id-keyed) ────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices','crm_templates'] LOOP
    EXECUTE format('CREATE POLICY member_view ON %I FOR SELECT USING (app_can_access_owner(user_id))', t);
    EXECUTE format('CREATE POLICY mgr_insert  ON %I FOR INSERT WITH CHECK (app_can_manage_owner(user_id))', t);
    EXECUTE format('CREATE POLICY mgr_update  ON %I FOR UPDATE USING (app_can_manage_owner(user_id)) WITH CHECK (app_can_manage_owner(user_id))', t);
    EXECUTE format('CREATE POLICY mgr_delete  ON %I FOR DELETE USING (app_can_manage_owner(user_id))', t);
  END LOOP;
END $$;

-- ── Client messages: members can view + send; only admin/owner can delete ──────
CREATE POLICY member_view   ON crm_messages FOR SELECT USING (app_can_access_owner(owner_id));
CREATE POLICY member_write  ON crm_messages FOR INSERT WITH CHECK (app_can_access_owner(owner_id));
CREATE POLICY member_modify ON crm_messages FOR UPDATE USING (app_can_access_owner(owner_id)) WITH CHECK (app_can_access_owner(owner_id));
CREATE POLICY mgr_delete    ON crm_messages FOR DELETE USING (app_can_manage_owner(owner_id));

-- ── Files: members can view + upload; only admin/owner can edit/delete ─────────
CREATE POLICY member_view  ON crm_files FOR SELECT USING (app_can_access_owner(owner_id));
CREATE POLICY member_write ON crm_files FOR INSERT WITH CHECK (app_can_access_owner(owner_id));
CREATE POLICY mgr_update   ON crm_files FOR UPDATE USING (app_can_manage_owner(owner_id)) WITH CHECK (app_can_manage_owner(owner_id));
CREATE POLICY mgr_delete   ON crm_files FOR DELETE USING (app_can_manage_owner(owner_id));
