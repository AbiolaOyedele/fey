-- ============================================================
-- Migration: Workspace architecture
-- Date: 2026-06-12
--
-- Changes:
--   1. Add workspace_slug + workspace_name to fey_settings
--   2. Refactor portal_users to use independent credentials
--      (no longer references auth.users for client accounts)
--   3. Drop FK on crm_messages.sender_id (clients aren't auth users)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. fey_settings: workspace identity columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE fey_settings
  ADD COLUMN IF NOT EXISTS workspace_slug TEXT,
  ADD COLUMN IF NOT EXISTS workspace_name TEXT NOT NULL DEFAULT '';

-- Unique slug constraint (partial — allows NULL rows for users not yet onboarded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fey_settings_workspace_slug
  ON fey_settings (workspace_slug)
  WHERE workspace_slug IS NOT NULL;

-- Backfill from portal_subdomain for any existing rows
UPDATE fey_settings
  SET workspace_slug = portal_subdomain
  WHERE portal_subdomain IS NOT NULL
    AND workspace_slug IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. portal_users: independent per-workspace credentials
--
--    The old schema had:
--      id UUID PRIMARY KEY REFERENCES auth.users(id)
--    This forced clients to be global Supabase Auth users, so
--    two workspaces couldn't share the same client email.
--
--    New schema:
--      id              UUID DEFAULT gen_random_uuid()  (no FK)
--      workspace_slug  TEXT (which workspace this login belongs to)
--      password_hash   TEXT (bcrypt hash)
--      email uniqueness is scoped to (workspace_slug, email)
-- ─────────────────────────────────────────────────────────────

-- Drop the auth.users FK on the primary key column.
-- Postgres default constraint name for FK on id is portal_users_id_fkey.
ALTER TABLE portal_users
  DROP CONSTRAINT IF EXISTS portal_users_id_fkey;

-- Add workspace_slug and password_hash columns
ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS workspace_slug TEXT,
  ADD COLUMN IF NOT EXISTS password_hash  TEXT;

-- Per-workspace email uniqueness (replaces global email uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_users_workspace_email
  ON portal_users (workspace_slug, email)
  WHERE workspace_slug IS NOT NULL;

-- Backfill workspace_slug from owner's fey_settings row
UPDATE portal_users pu
  SET workspace_slug = fs.workspace_slug
  FROM fey_settings fs
  WHERE fs.user_id = pu.owner_id
    AND fs.workspace_slug IS NOT NULL
    AND pu.workspace_slug IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. crm_messages: drop sender_id FK to auth.users
--
--    Portal clients send messages with sender_id = their portal_users.id.
--    Since portal_users.id no longer references auth.users, the FK
--    on crm_messages.sender_id must be dropped.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE crm_messages
  DROP CONSTRAINT IF EXISTS crm_messages_sender_id_fkey;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS cleanup
--
--    The old "portal_user_self" policy granted clients SELECT on
--    their own portal_users row via auth.uid(). That only worked
--    when clients were Supabase Auth users. Portal API routes now
--    use the service role client + manual JWT verification, so
--    client-facing RLS policies are redundant.
--
--    Owner policies (owner_id = auth.uid()) are unchanged.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "portal_user_self"      ON portal_users;
DROP POLICY IF EXISTS "portal_client_select"  ON portal_users;
DROP POLICY IF EXISTS "client_send_message"   ON crm_messages;
DROP POLICY IF EXISTS "client_select_message" ON crm_messages;
DROP POLICY IF EXISTS "client_select_files"   ON crm_files;
DROP POLICY IF EXISTS "client_select_contracts" ON crm_contracts;
DROP POLICY IF EXISTS "client_select_forms"   ON crm_forms;
