-- ════════════════════════════════════════════════════════════════════════════
-- Projects: workspace team access
-- Date: 2026-06-15
--
-- The projects feature shipped with owner-only RLS (owner_id = auth.uid()), so
-- invited teammates couldn't see a client's projects even though they can see
-- the client's other CRM data. This adds member/manager policies mirroring the
-- CRM (Phase 2 v2):
--   • projects (the records)        → members view; admin/owner manage
--   • project_messages              → members view + send; admin/owner delete
--   • project_files                 → members view + upload; admin/owner delete
--
-- Uses the existing app_can_access_owner / app_can_manage_owner helpers. The
-- original owner_id = auth.uid() policies stay (Postgres OR's permissive
-- policies), so owners are unaffected. Clients access projects via the
-- service-role portal routes, not RLS.
-- ════════════════════════════════════════════════════════════════════════════

-- projects: view for members, manage for admin/owner
DROP POLICY IF EXISTS member_view  ON projects;
CREATE POLICY member_view  ON projects FOR SELECT USING (app_can_access_owner(owner_id));
DROP POLICY IF EXISTS mgr_insert  ON projects;
CREATE POLICY mgr_insert  ON projects FOR INSERT WITH CHECK (app_can_manage_owner(owner_id));
DROP POLICY IF EXISTS mgr_update  ON projects;
CREATE POLICY mgr_update  ON projects FOR UPDATE USING (app_can_manage_owner(owner_id)) WITH CHECK (app_can_manage_owner(owner_id));
DROP POLICY IF EXISTS mgr_delete  ON projects;
CREATE POLICY mgr_delete  ON projects FOR DELETE USING (app_can_manage_owner(owner_id));

-- project_messages: members view + send; admin/owner delete
DROP POLICY IF EXISTS member_view   ON project_messages;
CREATE POLICY member_view   ON project_messages FOR SELECT USING (app_can_access_owner(owner_id));
DROP POLICY IF EXISTS member_write  ON project_messages;
CREATE POLICY member_write  ON project_messages FOR INSERT WITH CHECK (app_can_access_owner(owner_id));
DROP POLICY IF EXISTS member_modify ON project_messages;
CREATE POLICY member_modify ON project_messages FOR UPDATE USING (app_can_access_owner(owner_id)) WITH CHECK (app_can_access_owner(owner_id));
DROP POLICY IF EXISTS mgr_delete    ON project_messages;
CREATE POLICY mgr_delete    ON project_messages FOR DELETE USING (app_can_manage_owner(owner_id));

-- project_files: members view + upload; admin/owner delete
DROP POLICY IF EXISTS member_view  ON project_files;
CREATE POLICY member_view  ON project_files FOR SELECT USING (app_can_access_owner(owner_id));
DROP POLICY IF EXISTS member_write ON project_files;
CREATE POLICY member_write ON project_files FOR INSERT WITH CHECK (app_can_access_owner(owner_id));
DROP POLICY IF EXISTS mgr_delete   ON project_files;
CREATE POLICY mgr_delete   ON project_files FOR DELETE USING (app_can_manage_owner(owner_id));
