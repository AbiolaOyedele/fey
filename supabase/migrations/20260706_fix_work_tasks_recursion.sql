-- ════════════════════════════════════════════════════════════════════════════
-- Fix (re-apply): infinite recursion in work_tasks RLS (error 42P17)
-- Date: 2026-07-06
--
-- Production is still throwing "infinite recursion detected in policy for
-- relation work_task_assignees" on GET /api/v1/tasks (24 occurrences since
-- 2026-06-21, most recently today) even though 20260619_work_tasks_rls_fix.sql
-- and 20260621_work_tasks_team.sql were written to fix exactly this. Whatever
-- the drift, this migration re-applies the full non-recursive policy set from
-- scratch (idempotent — safe to run even if some of it is already correct).
--
-- Root cause recap: work_tasks' SELECT policy queried work_task_assignees via
-- an inline EXISTS, and work_task_assignees' SELECT policy queried work_tasks
-- via an inline EXISTS. Each subquery re-triggers the OTHER table's RLS, so
-- evaluating either policy loops forever. Fix: read the "other" table through
-- a SECURITY DEFINER function (owned by a role that bypasses RLS), never via
-- an inline subquery inside another table's policy.
-- ════════════════════════════════════════════════════════════════════════════

-- True if the current user is an assignee of `task` (reads work_task_assignees
-- via a SECURITY DEFINER function, bypassing its RLS).
CREATE OR REPLACE FUNCTION app_is_task_assignee(task UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM work_task_assignees a
    WHERE a.task_id = task AND a.user_id = auth.uid()
  );
$$;

-- The full work_tasks visibility rule (incl. 'team' visibility), evaluated
-- against the task row directly (bypasses work_tasks RLS). Used by every
-- child-table policy so none of them recurse back into work_tasks' own RLS.
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

-- ── work_tasks: SELECT/UPDATE via the assignee helper, never an inline subquery ──
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

-- ── work_task_files: same rule via its own helper — also missing the 'team'
-- visibility branch (bug: unlinked team-visibility tasks' files were
-- invisible to teammates) — fixed here alongside the recursion fix.
CREATE OR REPLACE FUNCTION app_can_access_work_task(p_task_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT app_can_see_task(p_task_id);
$$;
