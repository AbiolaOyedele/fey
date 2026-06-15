-- ════════════════════════════════════════════════════════════════════════════
-- Fey — combined migration to run after the 2026-06-15 feature batch
-- ════════════════════════════════════════════════════════════════════════════
-- Paste this whole file into the Supabase SQL editor and run once. It is
-- idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS), so re-running is safe.
--
-- Covers:
--   1. Message settings + portal activity  (read receipts, retention, last_seen)
--   2. Feedback inbox                       (in-app feedback button + admin board)
--   3. Client archive                       (archive/unarchive clients)
--   4. Projects                             (per-client chat + files containers)
--
-- After running, also set these env vars on Vercel (and .env.local):
--   ADMIN_EMAILS=heyyabiola@gmail.com         (unlocks /admin + feedback emails)
--   (confirm) RESEND_API_KEY                  (feedback email copy)
--   (optional) CRON_SECRET                    (message retention cron)
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. Message settings + portal activity ──────────────────────────────────
-- Unblocks: read receipts (owner setting), message retention selector, and the
-- "Active"/last-seen indicator for clients on the portal.

ALTER TABLE portal_users  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE fey_settings  ADD COLUMN IF NOT EXISTS portal_read_receipts   text NOT NULL DEFAULT 'true';
ALTER TABLE fey_settings  ADD COLUMN IF NOT EXISTS message_retention_days text NOT NULL DEFAULT '60';


-- ─── 2. Feedback inbox ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid,
  source       text NOT NULL DEFAULT 'owner'  CHECK (source IN ('owner', 'portal')),
  type         text NOT NULL DEFAULT 'other'  CHECK (type IN ('bug', 'feature', 'other')),
  message      text NOT NULL,
  page_url     text,
  user_agent   text,
  status       text NOT NULL DEFAULT 'new'    CHECK (status IN ('new', 'triaged', 'done')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_status_idx     ON feedback (status);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_insert_own ON feedback;
CREATE POLICY feedback_insert_own ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS feedback_select_own ON feedback;
CREATE POLICY feedback_select_own ON feedback
  FOR SELECT USING (auth.uid() = user_id);
-- (Admin board reads all rows via the service role, which bypasses RLS.)


-- ─── 3. Client archive ──────────────────────────────────────────────────────

ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS crm_contacts_archived_idx ON crm_contacts (archived_at);


-- ─── 4. Projects (per-client chat + files containers) ───────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id   UUID        NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  start_date   DATE,
  due_date     DATE,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_contact   ON projects (contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects (workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_archived  ON projects (archived_at);

CREATE TABLE IF NOT EXISTS project_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id     UUID        NOT NULL REFERENCES auth.users(id),
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  sender_type  TEXT        NOT NULL CHECK (sender_type IN ('owner', 'client')),
  sender_id    UUID        NOT NULL,
  body         TEXT        NOT NULL,
  body_html    TEXT,
  attachments  JSONB       NOT NULL DEFAULT '[]',
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_messages_project ON project_messages (project_id);

CREATE TABLE IF NOT EXISTS project_files (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id      UUID        NOT NULL REFERENCES auth.users(id),
  workspace_id  UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  uploader_type TEXT        NOT NULL CHECK (uploader_type IN ('owner', 'client')),
  file_name     TEXT        NOT NULL,
  file_url      TEXT        NOT NULL,
  public_id     TEXT,
  file_size     INTEGER,
  file_type     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files (project_id);

ALTER TABLE projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_projects ON projects;
CREATE POLICY owner_projects ON projects
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_project_messages ON project_messages;
CREATE POLICY owner_project_messages ON project_messages
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_project_files ON project_files;
CREATE POLICY owner_project_files ON project_files
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- Done. Portal (client) access to projects is mediated server-side by the API
-- routes using the service role + an ownership check, so no client RLS needed.
-- ════════════════════════════════════════════════════════════════════════════
