-- ════════════════════════════════════════════════════════════════════════════
-- Tasks: drop the client_id → clients foreign key
-- Date: 2026-06-14
--
-- The client-detail Tasks tab lives under the CRM, so it writes tasks with
-- client_id = a crm_contacts id. But tasks.client_id had a FK to the legacy
-- `clients` table, so every CRM-client task failed with:
--   insert or update on table "tasks" violates foreign key constraint
--   "tasks_client_id_fkey"
--
-- tasks.client_id is now a soft reference that can point at either model
-- (legacy clients OR crm_contacts), so we drop the constraint. Ownership is
-- still enforced by user_id + RLS.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_client_id_fkey;
