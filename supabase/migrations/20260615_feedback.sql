-- ════════════════════════════════════════════════════════════════════════════
-- Feedback / feature-request inbox
-- Date: 2026-06-15
--
-- Backs the in-app "Submit feedback" button. Owners insert their own rows;
-- the personal admin board reads all rows via the service role (bypasses RLS).
-- A copy of each submission is also emailed to the admin (best-effort), so this
-- table is the durable record + status tracker.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid,
  source      text NOT NULL DEFAULT 'owner'  CHECK (source IN ('owner', 'portal')),
  type        text NOT NULL DEFAULT 'other'  CHECK (type IN ('bug', 'feature', 'other')),
  message     text NOT NULL,
  page_url    text,
  user_agent  text,
  status      text NOT NULL DEFAULT 'new'    CHECK (status IN ('new', 'triaged', 'done')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_status_idx     ON feedback (status);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Owners may insert feedback attributed to themselves.
DROP POLICY IF EXISTS feedback_insert_own ON feedback;
CREATE POLICY feedback_insert_own ON feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owners may read back their own submissions (e.g. to confirm/echo).
DROP POLICY IF EXISTS feedback_select_own ON feedback;
CREATE POLICY feedback_select_own ON feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- NOTE: the admin board reads every row through the service-role client, which
-- bypasses RLS. No broad SELECT policy is granted to ordinary users on purpose.
