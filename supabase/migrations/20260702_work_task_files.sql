-- ════════════════════════════════════════════════════════════════════════════
-- Task file attachments (work_tasks)
-- Date: 2026-07-02
--
-- Files uploaded to Cloudinary and attached to work_tasks. Metadata only —
-- binaries live in Cloudinary under fey/work-tasks/<task_id>/.
--
-- The legacy task_files table FKs the old `tasks`/`clients` billing system and
-- is left untouched (same convention as 20260619_work_tasks.sql).
--
-- Visibility mirrors work_tasks exactly: a file is visible/manageable iff the
-- parent task is. Portal clients read through the service role (portal API),
-- so no anon policies exist.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS work_task_files (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID        NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by   UUID,       -- no FK: teammate today, possibly a portal user later
  uploader_name TEXT,
  file_name     TEXT        NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 300),
  file_url      TEXT        NOT NULL,
  public_id     TEXT        NOT NULL,
  file_size     INTEGER     CHECK (file_size IS NULL OR file_size >= 0),
  file_type     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_task_files_task ON work_task_files (task_id, created_at DESC);

-- Same visibility rule as work_tasks_select (20260619_work_tasks.sql), wrapped
-- in a SECURITY DEFINER helper so the three policies below share one predicate.
CREATE OR REPLACE FUNCTION app_can_access_work_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM work_tasks t
    WHERE t.id = p_task_id
      AND t.deleted_at IS NULL
      AND (
        (
          (t.project_id IS NOT NULL OR t.contact_id IS NOT NULL)
          AND app_can_access_owner(t.owner_id)
        )
        OR
        (
          t.project_id IS NULL AND t.contact_id IS NULL
          AND (
            t.created_by = auth.uid()
            OR EXISTS (
              SELECT 1 FROM work_task_assignees a
              WHERE a.task_id = t.id AND a.user_id = auth.uid()
            )
          )
        )
      )
  );
$$;

ALTER TABLE work_task_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_task_files_select ON work_task_files;
CREATE POLICY work_task_files_select ON work_task_files FOR SELECT
  USING (app_can_access_work_task(task_id));

DROP POLICY IF EXISTS work_task_files_insert ON work_task_files;
CREATE POLICY work_task_files_insert ON work_task_files FOR INSERT
  WITH CHECK (app_can_access_work_task(task_id) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS work_task_files_delete ON work_task_files;
CREATE POLICY work_task_files_delete ON work_task_files FOR DELETE
  USING (app_can_access_work_task(task_id));
