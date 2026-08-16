-- ════════════════════════════════════════════════════════════════════════════
-- Tasks: responsibility handoff + stage approval gates
-- Date: 2026-08-16
--
-- Until now a task's assignees were a flat set, so a task that stalled in
-- someone else's stage kept nagging everyone who had ever touched it: the daily
-- digest mailed every assignee, and Insights counted the same overdue task
-- against each of them. Nothing recorded WHOSE TURN it was.
--
-- Two ideas, added together:
--
--   1. The baton — `work_tasks.responsible_id` is the single person the task
--      sits with right now. Assignees remain the cast (who's involved);
--      responsibility is who's answerable today. Overdue attaches to the baton
--      holder, so a delay downstream can no longer land on the person who
--      already did their part.
--
--   2. Approval gates — a stage can require a named approver's sign-off before
--      work leaves it. Approving advances the task; requesting changes sends it
--      back to the previous stage AND returns the baton to whoever handed it
--      over, so the chain runs both ways.
--
-- `work_task_handoffs` records every pass of the baton. It's the audit trail
-- ("who held this, for how long"), and the source for stage-bottleneck reporting
-- — which is the honest version of the question "why was this late".
--
-- Fairness note: lateness is measured per stage, not per task. `stage_entered_at`
-- plus `workflow_stages.target_days` gives each stage its own clock, so a
-- designer who finished on time isn't marked late by a task-level due date that
-- a later stage blew through.
-- ════════════════════════════════════════════════════════════════════════════

-- ── work_tasks: who holds it, since when, and whether it's waiting on a ruling ──
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS responsible_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS approval_state   TEXT        NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_tasks_approval_state_check') THEN
    ALTER TABLE work_tasks ADD CONSTRAINT work_tasks_approval_state_check
      CHECK (approval_state IN ('none', 'pending', 'approved', 'changes_requested'));
  END IF;
END $$;

COMMENT ON COLUMN work_tasks.responsible_id IS
  'The single person the task sits with right now — the baton. Overdue and the daily digest attribute here, not to every assignee.';
COMMENT ON COLUMN work_tasks.stage_entered_at IS
  'When the task entered its current stage. With workflow_stages.target_days this gives each stage its own clock, so lateness lands on the stage that caused it.';
COMMENT ON COLUMN work_tasks.approval_state IS
  'none = no gate involved. pending = sitting in a gated stage awaiting sign-off. approved / changes_requested = the last ruling made on it.';

-- The digest and "On my desk" both read tasks by holder — this is their index.
CREATE INDEX IF NOT EXISTS idx_work_tasks_responsible
  ON work_tasks (responsible_id)
  WHERE deleted_at IS NULL AND done = false;

-- ── workflow_stages: how the baton passes, and whether the stage is gated ───────
ALTER TABLE workflow_stages
  ADD COLUMN IF NOT EXISTS handoff_mode      TEXT    NOT NULL DEFAULT 'keep',
  ADD COLUMN IF NOT EXISTS handoff_user_id   UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approver_id       UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_days       INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_stages_handoff_mode_check') THEN
    ALTER TABLE workflow_stages ADD CONSTRAINT workflow_stages_handoff_mode_check
      CHECK (handoff_mode IN ('keep', 'fixed', 'prompt'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_stages_target_days_check') THEN
    ALTER TABLE workflow_stages ADD CONSTRAINT workflow_stages_target_days_check
      CHECK (target_days IS NULL OR (target_days > 0 AND target_days <= 365));
  END IF;
END $$;

COMMENT ON COLUMN workflow_stages.handoff_mode IS
  'Who picks up the baton on entering this stage. keep = the current holder stays on it; fixed = always handoff_user_id; prompt = whoever moves the task chooses.';
COMMENT ON COLUMN workflow_stages.handoff_user_id IS
  'The standing owner of this stage, for handoff_mode = fixed. Deliberately NOT constrained NOT NULL against the mode: if that person leaves the workspace this is set to NULL and the stage degrades to keep-the-holder rather than blocking their deletion.';
COMMENT ON COLUMN workflow_stages.requires_approval IS
  'When true, a task cannot leave this stage until the approver signs off. The move is refused in the service layer, not by RLS.';
COMMENT ON COLUMN workflow_stages.approver_id IS
  'Who may rule on a gated stage. NULL (including after that person leaves) falls back to anyone who can manage the workspace, so a gate can never strand a task with nobody able to open it.';
COMMENT ON COLUMN workflow_stages.target_days IS
  'How long work should sit in this stage before it counts as stalled. Drives the stage clock and bottleneck reporting.';

-- ── work_task_handoffs (every pass of the baton) ───────────────────────────────
CREATE TABLE IF NOT EXISTS work_task_handoffs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID        NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_stage_id UUID        REFERENCES workflow_stages(id) ON DELETE SET NULL,
  to_stage_id   UUID        REFERENCES workflow_stages(id) ON DELETE SET NULL,
  from_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- What kind of pass this was. 'moved' is an ordinary stage change; the two
  -- rulings are recorded distinctly so the bottleneck report can separate work
  -- that flowed from work that was sent back.
  kind          TEXT        NOT NULL DEFAULT 'moved'
                CHECK (kind IN ('moved', 'approved', 'changes_requested', 'reassigned')),
  note          TEXT        CHECK (note IS NULL OR char_length(note) <= 2000),
  -- How long the task sat in from_stage before this pass. Stored rather than
  -- derived: stages get renamed and deleted, and the history has to survive it.
  held_seconds  INTEGER     CHECK (held_seconds IS NULL OR held_seconds >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_task_handoffs_task  ON work_task_handoffs (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_task_handoffs_owner ON work_task_handoffs (owner_id, created_at DESC);

-- ── Keep the stage clock honest, whoever writes the row ────────────────────────
-- Stamped by a trigger rather than the service so an import, a backfill or a
-- future code path can't leave stage_entered_at lying about when work started.
CREATE OR REPLACE FUNCTION work_tasks_stamp_stage_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_entered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_tasks_stage_entry ON work_tasks;
CREATE TRIGGER trg_work_tasks_stage_entry
  BEFORE UPDATE ON work_tasks
  FOR EACH ROW
  EXECUTE FUNCTION work_tasks_stamp_stage_entry();

-- ── RLS ────────────────────────────────────────────────────────────────────────
-- Same shape as work_subtasks: the handoff log inherits its parent task's
-- visibility, so the subquery is filtered by work_tasks' own SELECT policy.
-- Writes go through the service (which re-checks who may move a gated task);
-- there is no UPDATE or DELETE policy because history is append-only.
ALTER TABLE work_task_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_task_handoffs_select ON work_task_handoffs;
CREATE POLICY work_task_handoffs_select ON work_task_handoffs FOR SELECT
  USING (EXISTS (SELECT 1 FROM work_tasks t WHERE t.id = task_id));

DROP POLICY IF EXISTS work_task_handoffs_insert ON work_task_handoffs;
CREATE POLICY work_task_handoffs_insert ON work_task_handoffs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM work_tasks t WHERE t.id = task_id));

-- ── Backfill ───────────────────────────────────────────────────────────────────
-- Every existing open task needs a holder, or it would vanish from both desks
-- the moment the new views ship. First assignee (longest-standing) wins, since
-- that's who the team already treats as the owner; otherwise the creator.
UPDATE work_tasks t
SET responsible_id = COALESCE(
  (SELECT a.user_id FROM work_task_assignees a
    WHERE a.task_id = t.id
    ORDER BY a.assigned_at ASC, a.user_id ASC
    LIMIT 1),
  t.created_by
)
WHERE t.responsible_id IS NULL
  AND t.deleted_at IS NULL;

-- The clock can't be recovered for tasks that moved before this migration —
-- last touch is the closest honest answer, and beats pretending every task
-- entered its stage at deploy time.
UPDATE work_tasks
SET stage_entered_at = updated_at
WHERE deleted_at IS NULL
  AND updated_at IS NOT NULL;

-- Realtime: the task list already subscribes to work_tasks; the handoff log is
-- read on open, so it doesn't need to join the stream.
