-- ════════════════════════════════════════════════════════════════════════════
-- Tasks rebuild — unified task system (work_tasks)
-- Date: 2026-06-19
--
-- Replaces the broken standalone_tasks/task_groups personal-task system. The
-- legacy `tasks` table is intentionally LEFT UNTOUCHED — it holds billing
-- line-items wired into payments/invoices/webhooks and is a separate concern.
--
-- New namespace: work_tasks, work_task_assignees, work_subtasks, workflows,
-- workflow_stages. A task may be:
--   • personal  — project_id IS NULL AND contact_id IS NULL
--                 → visible only to its creator + assignees
--   • linked    — contact_id and/or project_id set
--                 → visible to the whole workspace, the client page, and the
--                   client portal. contact_id is denormalized from the project
--                   when project-linked (enforced in the service layer).
--
-- RLS reuses the existing SECURITY DEFINER helpers app_can_access_owner /
-- app_can_manage_owner (the same pattern the CRM tables use). No `app` column —
-- matches the workspace-era `projects` table convention.
-- ════════════════════════════════════════════════════════════════════════════

-- ── workflows (configurable kanban stage sets) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  is_default   BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

-- One default workflow per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_workflow_per_workspace
  ON workflows (workspace_id)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_owner ON workflows (owner_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS workflow_stages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID        NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  color       TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_stages_workflow ON workflow_stages (workflow_id, sort_order);

-- Projects choose a workflow; NULL = the workspace default.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL;

-- ── work_tasks (unified — personal + client/project linked) ─────────────────────
CREATE TABLE IF NOT EXISTS work_tasks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id      UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id        UUID        REFERENCES projects(id) ON DELETE CASCADE,
  contact_id        UUID        REFERENCES crm_contacts(id) ON DELETE CASCADE,
  stage_id          UUID        REFERENCES workflow_stages(id) ON DELETE SET NULL,
  created_by        UUID        NOT NULL REFERENCES auth.users(id),

  title             TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  description       TEXT,
  priority          TEXT        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  start_date        DATE,
  due_date          DATE,
  estimated_minutes INTEGER     CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
  logged_minutes    INTEGER     NOT NULL DEFAULT 0 CHECK (logged_minutes >= 0),

  sort_order        INTEGER     NOT NULL DEFAULT 0,
  done              BOOLEAN     NOT NULL DEFAULT false,
  completed_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_work_tasks_owner     ON work_tasks (owner_id)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_tasks_workspace ON work_tasks (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_tasks_project   ON work_tasks (project_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_tasks_contact   ON work_tasks (contact_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_tasks_stage     ON work_tasks (stage_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_due       ON work_tasks (due_date)     WHERE deleted_at IS NULL AND done = false;
CREATE INDEX IF NOT EXISTS idx_work_tasks_personal  ON work_tasks (owner_id, created_by)
  WHERE project_id IS NULL AND contact_id IS NULL AND deleted_at IS NULL;

-- ── work_task_assignees (many-to-many) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_task_assignees (
  task_id     UUID        NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_work_task_assignees_user ON work_task_assignees (user_id);

-- ── work_subtasks (checklist items, one level deep) ─────────────────────────────
CREATE TABLE IF NOT EXISTS work_subtasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  done       BOOLEAN     NOT NULL DEFAULT false,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_subtasks_task ON work_subtasks (task_id, sort_order);

-- ════════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE workflows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_subtasks       ENABLE ROW LEVEL SECURITY;

-- ── workflows: members read; managers configure ─────────────────────────────────
DROP POLICY IF EXISTS workflows_select ON workflows;
CREATE POLICY workflows_select ON workflows FOR SELECT USING (app_can_access_owner(owner_id));
DROP POLICY IF EXISTS workflows_insert ON workflows;
CREATE POLICY workflows_insert ON workflows FOR INSERT WITH CHECK (app_can_manage_owner(owner_id));
DROP POLICY IF EXISTS workflows_update ON workflows;
CREATE POLICY workflows_update ON workflows FOR UPDATE USING (app_can_manage_owner(owner_id)) WITH CHECK (app_can_manage_owner(owner_id));
DROP POLICY IF EXISTS workflows_delete ON workflows;
CREATE POLICY workflows_delete ON workflows FOR DELETE USING (app_can_manage_owner(owner_id));

-- ── workflow_stages: inherit visibility from the parent workflow ─────────────────
DROP POLICY IF EXISTS workflow_stages_select ON workflow_stages;
CREATE POLICY workflow_stages_select ON workflow_stages FOR SELECT
  USING (EXISTS (SELECT 1 FROM workflows w WHERE w.id = workflow_id));
DROP POLICY IF EXISTS workflow_stages_write ON workflow_stages;
CREATE POLICY workflow_stages_write ON workflow_stages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM workflows w WHERE w.id = workflow_id AND app_can_manage_owner(w.owner_id)));
DROP POLICY IF EXISTS workflow_stages_update ON workflow_stages;
CREATE POLICY workflow_stages_update ON workflow_stages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM workflows w WHERE w.id = workflow_id AND app_can_manage_owner(w.owner_id)));
DROP POLICY IF EXISTS workflow_stages_delete ON workflow_stages;
CREATE POLICY workflow_stages_delete ON workflow_stages FOR DELETE
  USING (EXISTS (SELECT 1 FROM workflows w WHERE w.id = workflow_id AND app_can_manage_owner(w.owner_id)));

-- ── work_tasks: the core visibility rule ────────────────────────────────────────
-- Linked tasks (contact/project set) are workspace-visible. Personal tasks
-- (both null) are private to creator + assignees.
DROP POLICY IF EXISTS work_tasks_select ON work_tasks;
CREATE POLICY work_tasks_select ON work_tasks FOR SELECT USING (
  (
    (project_id IS NOT NULL OR contact_id IS NOT NULL)
    AND app_can_access_owner(owner_id)
  )
  OR
  (
    project_id IS NULL AND contact_id IS NULL
    AND (
      created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM work_task_assignees a WHERE a.task_id = work_tasks.id AND a.user_id = auth.uid())
    )
  )
);

-- Any workspace member can create a task under that workspace's owner.
DROP POLICY IF EXISTS work_tasks_insert ON work_tasks;
CREATE POLICY work_tasks_insert ON work_tasks FOR INSERT WITH CHECK (
  created_by = auth.uid() AND app_can_access_owner(owner_id)
);

-- Members may edit linked tasks; only creator/assignee may edit personal tasks.
DROP POLICY IF EXISTS work_tasks_update ON work_tasks;
CREATE POLICY work_tasks_update ON work_tasks FOR UPDATE USING (
  (
    (project_id IS NOT NULL OR contact_id IS NOT NULL)
    AND app_can_access_owner(owner_id)
  )
  OR
  (
    project_id IS NULL AND contact_id IS NULL
    AND (
      created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM work_task_assignees a WHERE a.task_id = work_tasks.id AND a.user_id = auth.uid())
    )
  )
) WITH CHECK (app_can_access_owner(owner_id));

-- Creator can always delete their own; managers can delete linked tasks.
DROP POLICY IF EXISTS work_tasks_delete ON work_tasks;
CREATE POLICY work_tasks_delete ON work_tasks FOR DELETE USING (
  created_by = auth.uid()
  OR ((project_id IS NOT NULL OR contact_id IS NOT NULL) AND app_can_manage_owner(owner_id))
);

-- ── work_task_assignees / work_subtasks: inherit parent-task visibility ──────────
DROP POLICY IF EXISTS work_task_assignees_select ON work_task_assignees;
CREATE POLICY work_task_assignees_select ON work_task_assignees FOR SELECT
  USING (EXISTS (SELECT 1 FROM work_tasks t WHERE t.id = task_id));
DROP POLICY IF EXISTS work_task_assignees_write ON work_task_assignees;
CREATE POLICY work_task_assignees_write ON work_task_assignees FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM work_tasks t WHERE t.id = task_id));
DROP POLICY IF EXISTS work_task_assignees_delete ON work_task_assignees;
CREATE POLICY work_task_assignees_delete ON work_task_assignees FOR DELETE
  USING (EXISTS (SELECT 1 FROM work_tasks t WHERE t.id = task_id));

DROP POLICY IF EXISTS work_subtasks_select ON work_subtasks;
CREATE POLICY work_subtasks_select ON work_subtasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM work_tasks t WHERE t.id = task_id));
DROP POLICY IF EXISTS work_subtasks_write ON work_subtasks;
CREATE POLICY work_subtasks_write ON work_subtasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM work_tasks t WHERE t.id = task_id));
DROP POLICY IF EXISTS work_subtasks_update ON work_subtasks;
CREATE POLICY work_subtasks_update ON work_subtasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM work_tasks t WHERE t.id = task_id));
DROP POLICY IF EXISTS work_subtasks_delete ON work_subtasks;
CREATE POLICY work_subtasks_delete ON work_subtasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM work_tasks t WHERE t.id = task_id));
