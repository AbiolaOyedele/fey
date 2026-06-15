-- ════════════════════════════════════════════════════════════════════════════
-- Projects: per-client containers with their own chat + files
-- Date: 2026-06-15
--
-- A project belongs to a client (crm_contacts) within a workspace. It bundles a
-- dedicated message thread and file area so everything for one piece of work
-- lives in one place. Supersedes the older "campaigns" concept going forward.
--
-- Owner access is via standard owner_id = auth.uid() RLS. Portal (client) access
-- is mediated server-side through dedicated API routes using the service role
-- (matching how the existing crm portal routes work), so no client RLS here.
-- ════════════════════════════════════════════════════════════════════════════

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
