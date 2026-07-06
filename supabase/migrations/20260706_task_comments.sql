-- ════════════════════════════════════════════════════════════════════════════
-- Task comments (with @mentions)
-- Date: 2026-07-06
--
-- Adds a comment thread to work_tasks. Visibility inherits from the parent
-- task (same pattern as work_subtasks / work_task_assignees) — anyone who can
-- see the task can see and add comments; only the author can edit/delete
-- their own comment. @Mentions inside a comment body reuse the existing
-- mentions ledger (supabase/migrations/20260703_mentions.sql) via a new
-- 'task_comment' entity type.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id, created_at);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Read/insert: inherit the parent task's visibility via the SECURITY DEFINER
-- helper (app_can_see_task, see 20260619_work_tasks_rls_fix.sql) rather than an
-- inline EXISTS against work_tasks — that pattern is what caused the
-- work_task_assignees infinite-recursion bug (42P17) fixed in
-- 20260706_fix_work_tasks_recursion.sql; task_comments must not repeat it.
DROP POLICY IF EXISTS task_comments_select ON task_comments;
CREATE POLICY task_comments_select ON task_comments FOR SELECT
  USING (app_can_see_task(task_id));
DROP POLICY IF EXISTS task_comments_insert ON task_comments;
CREATE POLICY task_comments_insert ON task_comments FOR INSERT
  WITH CHECK (author_id = auth.uid() AND app_can_see_task(task_id));

-- Edit/delete: author only.
DROP POLICY IF EXISTS task_comments_update ON task_comments;
CREATE POLICY task_comments_update ON task_comments FOR UPDATE
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS task_comments_delete ON task_comments;
CREATE POLICY task_comments_delete ON task_comments FOR DELETE
  USING (author_id = auth.uid());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Extend the mentions entity_type enum with 'task_comment' ────────────────
ALTER TABLE mentions DROP CONSTRAINT IF EXISTS mentions_entity_type_check;
ALTER TABLE mentions ADD CONSTRAINT mentions_entity_type_check
  CHECK (entity_type IN ('task_description', 'subtask', 'internal_message', 'crm_message', 'task_comment'));
