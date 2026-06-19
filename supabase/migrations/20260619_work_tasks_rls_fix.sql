-- ════════════════════════════════════════════════════════════════════════════
-- Fix: infinite recursion in work_tasks RLS (error 42P17)
-- Date: 2026-06-19
--
-- The work_tasks SELECT/UPDATE policies referenced work_task_assignees via a
-- subquery, and the work_task_assignees / work_subtasks policies referenced
-- work_tasks via a subquery. Each subquery re-applies the OTHER table's RLS, so
-- evaluating either policy loops forever.
--
-- Break the cycle with SECURITY DEFINER helpers (owned by the migration runner,
-- so they bypass RLS) — the same pattern app_can_access_owner already uses.
-- Run this AFTER 20260619_work_tasks.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- True if the current user is an assignee of `task` (reads work_task_assignees
-- without triggering its RLS).
CREATE OR REPLACE FUNCTION app_is_task_assignee(task UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM work_task_assignees a
    WHERE a.task_id = task AND a.user_id = auth.uid()
  );
$$;

-- The full work_tasks visibility rule, evaluated against the task row directly
-- (bypasses work_tasks RLS). Used by child-table policies so they don't recurse.
CREATE OR REPLACE FUNCTION app_can_see_task(task UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM work_tasks t
    WHERE t.id = task
      AND t.deleted_at IS NULL
      AND (
        ((t.project_id IS NOT NULL OR t.contact_id IS NOT NULL) AND app_can_access_owner(t.owner_id))
        OR
        (t.project_id IS NULL AND t.contact_id IS NULL
          AND (t.created_by = auth.uid() OR app_is_task_assignee(t.id)))
      )
  );
$$;

-- ── work_tasks: use the assignee helper instead of an inline subquery ────────────
DROP POLICY IF EXISTS work_tasks_select ON work_tasks;
CREATE POLICY work_tasks_select ON work_tasks FOR SELECT USING (
  ((project_id IS NOT NULL OR contact_id IS NOT NULL) AND app_can_access_owner(owner_id))
  OR
  (project_id IS NULL AND contact_id IS NULL AND (created_by = auth.uid() OR app_is_task_assignee(id)))
);

DROP POLICY IF EXISTS work_tasks_update ON work_tasks;
CREATE POLICY work_tasks_update ON work_tasks FOR UPDATE USING (
  ((project_id IS NOT NULL OR contact_id IS NOT NULL) AND app_can_access_owner(owner_id))
  OR
  (project_id IS NULL AND contact_id IS NULL AND (created_by = auth.uid() OR app_is_task_assignee(id)))
) WITH CHECK (app_can_access_owner(owner_id));

-- ── work_task_assignees: visibility via the helper (no recursion) ────────────────
DROP POLICY IF EXISTS work_task_assignees_select ON work_task_assignees;
CREATE POLICY work_task_assignees_select ON work_task_assignees FOR SELECT USING (app_can_see_task(task_id));
DROP POLICY IF EXISTS work_task_assignees_write ON work_task_assignees;
CREATE POLICY work_task_assignees_write ON work_task_assignees FOR INSERT WITH CHECK (app_can_see_task(task_id));
DROP POLICY IF EXISTS work_task_assignees_delete ON work_task_assignees;
CREATE POLICY work_task_assignees_delete ON work_task_assignees FOR DELETE USING (app_can_see_task(task_id));

-- ── work_subtasks: visibility via the helper (no recursion) ──────────────────────
DROP POLICY IF EXISTS work_subtasks_select ON work_subtasks;
CREATE POLICY work_subtasks_select ON work_subtasks FOR SELECT USING (app_can_see_task(task_id));
DROP POLICY IF EXISTS work_subtasks_write ON work_subtasks;
CREATE POLICY work_subtasks_write ON work_subtasks FOR INSERT WITH CHECK (app_can_see_task(task_id));
DROP POLICY IF EXISTS work_subtasks_update ON work_subtasks;
CREATE POLICY work_subtasks_update ON work_subtasks FOR UPDATE USING (app_can_see_task(task_id));
DROP POLICY IF EXISTS work_subtasks_delete ON work_subtasks;
CREATE POLICY work_subtasks_delete ON work_subtasks FOR DELETE USING (app_can_see_task(task_id));
