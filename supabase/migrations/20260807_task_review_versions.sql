-- ════════════════════════════════════════════════════════════════════════════
-- Task review — deliverable versions + review notes
-- Date: 2026-08-07
--
-- A task's Review tab holds the thing that was actually produced, not the
-- working attachments. Each upload supersedes the last and becomes a numbered
-- version; the team and the client both review it in the same thread.
--
-- Only THREE versions are kept. When a fourth is uploaded the oldest row is
-- deleted by the service, which also removes its Cloudinary asset — the point
-- is to stop old deliverables accumulating storage forever. The cap is enforced
-- in the service rather than a trigger because the binary lives outside
-- Postgres and only application code can clean it up.
--
-- Visibility reuses app_can_access_work_task() from 20260702_work_task_files.sql:
-- a version is visible/manageable exactly when its parent task is. Portal
-- clients read and write through the service role (portal API verifies their
-- JWT first), so there are no anon policies here either.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Versions ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_task_reviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID        NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  owner_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 1-based and monotonic per task. Never reused, so "v2" keeps meaning the
  -- same upload even after v1 has been pruned.
  version        INTEGER     NOT NULL CHECK (version >= 1),

  file_name      TEXT        NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 300),
  file_url       TEXT        NOT NULL,
  public_id      TEXT        NOT NULL,
  file_size      INTEGER     CHECK (file_size IS NULL OR file_size >= 0),
  file_type      TEXT,

  -- Exactly one of these is set. Portal users aren't auth users, so they can't
  -- share a column with teammates (same split as work_tasks.requested_by_portal_user).
  uploaded_by             UUID,
  uploaded_by_portal_user UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  uploader_name           TEXT,

  -- pending until someone rules on it; the newest version's status is what the
  -- task's review state means.
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'changes_requested')),

  -- Set when a newer version arrives. Kept rather than derived so a superseded
  -- version can say when it stopped being current.
  superseded_at  TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (task_id, version)
);

CREATE INDEX IF NOT EXISTS idx_work_task_reviews_task
  ON work_task_reviews (task_id, version DESC);

-- ── Review notes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_task_review_comments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id     UUID        NOT NULL REFERENCES work_task_reviews(id) ON DELETE CASCADE,
  -- Denormalized so the RLS predicate doesn't need to join back through the
  -- version row on every read.
  task_id       UUID        NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  author_id             UUID,
  author_portal_user    UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  author_name           TEXT,
  -- Which side of the portal the note came from, so the UI can label it without
  -- resolving the author.
  author_type   TEXT        NOT NULL CHECK (author_type IN ('team', 'client')),

  body          TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  -- A note may also carry a ruling. NULL = comment only.
  decision      TEXT        CHECK (decision IS NULL OR decision IN ('approved', 'changes_requested')),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_task_review_comments_review
  ON work_task_review_comments (review_id, created_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE work_task_reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_task_review_comments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_task_reviews_select ON work_task_reviews;
CREATE POLICY work_task_reviews_select ON work_task_reviews FOR SELECT
  USING (app_can_access_work_task(task_id));

DROP POLICY IF EXISTS work_task_reviews_insert ON work_task_reviews;
CREATE POLICY work_task_reviews_insert ON work_task_reviews FOR INSERT
  WITH CHECK (app_can_access_work_task(task_id) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS work_task_reviews_update ON work_task_reviews;
CREATE POLICY work_task_reviews_update ON work_task_reviews FOR UPDATE
  USING (app_can_access_work_task(task_id))
  WITH CHECK (app_can_access_work_task(task_id));

DROP POLICY IF EXISTS work_task_reviews_delete ON work_task_reviews;
CREATE POLICY work_task_reviews_delete ON work_task_reviews FOR DELETE
  USING (app_can_access_work_task(task_id));

DROP POLICY IF EXISTS work_task_review_comments_select ON work_task_review_comments;
CREATE POLICY work_task_review_comments_select ON work_task_review_comments FOR SELECT
  USING (app_can_access_work_task(task_id));

DROP POLICY IF EXISTS work_task_review_comments_insert ON work_task_review_comments;
CREATE POLICY work_task_review_comments_insert ON work_task_review_comments FOR INSERT
  WITH CHECK (app_can_access_work_task(task_id) AND author_id = auth.uid());

-- Notes are part of a review record: editing them after the fact would rewrite
-- what someone agreed to, so there is no update policy. Deleting a version
-- takes its notes with it via ON DELETE CASCADE.
DROP POLICY IF EXISTS work_task_review_comments_delete ON work_task_review_comments;
CREATE POLICY work_task_review_comments_delete ON work_task_review_comments FOR DELETE
  USING (app_can_access_work_task(task_id) AND author_id = auth.uid());
