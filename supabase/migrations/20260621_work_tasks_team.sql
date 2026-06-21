-- ════════════════════════════════════════════════════════════════════════════
-- Tasks: add a "team" visibility for unlinked tasks
-- Date: 2026-06-21
--
-- Until now an unlinked task (no client, no project) was always personal
-- (private to creator + assignees). This adds a third bucket:
--   • personal — unlinked, visibility='personal' → creator + assignees only
--   • team     — unlinked, visibility='team'     → all workspace members, NOT clients
--   • client   — contact_id/project_id set       → workspace + client + portal (unchanged)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'personal'
  CHECK (visibility IN ('personal', 'team'));

-- ── work_tasks SELECT/UPDATE: add the team branch ──────────────────────────────
DROP POLICY IF EXISTS work_tasks_select ON work_tasks;
CREATE POLICY work_tasks_select ON work_tasks FOR SELECT USING (
  ((project_id IS NOT NULL OR contact_id IS NOT NULL) AND app_can_access_owner(owner_id))
  OR (project_id IS NULL AND contact_id IS NULL AND visibility = 'team' AND app_can_access_owner(owner_id))
  OR (project_id IS NULL AND contact_id IS NULL AND visibility = 'personal'
      AND (created_by = auth.uid() OR app_is_task_assignee(id)))
);

DROP POLICY IF EXISTS work_tasks_update ON work_tasks;
CREATE POLICY work_tasks_update ON work_tasks FOR UPDATE USING (
  ((project_id IS NOT NULL OR contact_id IS NOT NULL) AND app_can_access_owner(owner_id))
  OR (project_id IS NULL AND contact_id IS NULL AND visibility = 'team' AND app_can_access_owner(owner_id))
  OR (project_id IS NULL AND contact_id IS NULL AND visibility = 'personal'
      AND (created_by = auth.uid() OR app_is_task_assignee(id)))
) WITH CHECK (app_can_access_owner(owner_id));

-- ── app_can_see_task: same rule, for child tables (assignees/subtasks) ──────────
CREATE OR REPLACE FUNCTION app_can_see_task(task UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM work_tasks t
    WHERE t.id = task
      AND t.deleted_at IS NULL
      AND (
        ((t.project_id IS NOT NULL OR t.contact_id IS NOT NULL) AND app_can_access_owner(t.owner_id))
        OR (t.project_id IS NULL AND t.contact_id IS NULL AND t.visibility = 'team' AND app_can_access_owner(t.owner_id))
        OR (t.project_id IS NULL AND t.contact_id IS NULL AND t.visibility = 'personal'
            AND (t.created_by = auth.uid() OR app_is_task_assignee(t.id)))
      )
  );
$$;
