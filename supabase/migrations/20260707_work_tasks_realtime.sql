-- ════════════════════════════════════════════════════════════════════════════
-- Realtime for work_tasks (+ assignees / subtasks)
-- Date: 2026-07-07
--
-- Tasks changes (create/move/complete/edit/assign) weren't broadcast over
-- Supabase Realtime, so the Tasks page only reflected the acting user's own
-- optimistic edits — anything done on another device, by a teammate, or from a
-- different view needed a manual refresh to appear. Add the three task tables
-- to the realtime publication so useTasks can subscribe and stay live.
--
-- Guarded so re-running is safe (a table can only be in the publication once).
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['work_tasks', 'work_task_assignees', 'work_subtasks'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
