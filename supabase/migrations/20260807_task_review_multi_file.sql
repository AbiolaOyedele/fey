-- ════════════════════════════════════════════════════════════════════════════
-- Task review — a version can hold several files
-- Date: 2026-08-07  (follows 20260807_task_review_versions.sql)
--
-- A deliverable is often more than one file: three logo variants, a video plus
-- its thumbnail, a deck and its source. Uploading those as separate VERSIONS
-- would be wrong twice over — they aren't revisions of each other, and three
-- files would instantly exhaust the three-version cap and prune real history.
--
-- So the files move to a child table and a version becomes a set. The cap still
-- counts versions, not files.
--
-- Existing rows are backfilled into the new table BEFORE the inline columns are
-- dropped, so nothing already uploaded is lost.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS work_task_review_files (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id  UUID        NOT NULL REFERENCES work_task_reviews(id) ON DELETE CASCADE,
  -- Denormalised so the RLS predicate doesn't join back through the version.
  task_id    UUID        NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,

  file_name  TEXT        NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 300),
  file_url   TEXT        NOT NULL,
  public_id  TEXT        NOT NULL,
  file_size  INTEGER     CHECK (file_size IS NULL OR file_size >= 0),
  file_type  TEXT,
  sort_order INTEGER     NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_task_review_files_review
  ON work_task_review_files (review_id, sort_order);

-- ── Backfill, then drop the inline columns ──────────────────────────────────
-- Guarded so re-running the migration is harmless.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_task_reviews' AND column_name = 'file_url'
  ) THEN
    INSERT INTO work_task_review_files
      (review_id, task_id, file_name, file_url, public_id, file_size, file_type, sort_order, created_at)
    SELECT r.id, r.task_id, r.file_name, r.file_url, r.public_id, r.file_size, r.file_type, 0, r.created_at
    FROM work_task_reviews r
    WHERE r.file_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM work_task_review_files f WHERE f.review_id = r.id
      );

    ALTER TABLE work_task_reviews
      DROP COLUMN IF EXISTS file_name,
      DROP COLUMN IF EXISTS file_url,
      DROP COLUMN IF EXISTS public_id,
      DROP COLUMN IF EXISTS file_size,
      DROP COLUMN IF EXISTS file_type;
  END IF;
END $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Same predicate as the version rows: reachable exactly when the task is.

ALTER TABLE work_task_review_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_task_review_files_select ON work_task_review_files;
CREATE POLICY work_task_review_files_select ON work_task_review_files FOR SELECT
  USING (app_can_access_work_task(task_id));

DROP POLICY IF EXISTS work_task_review_files_insert ON work_task_review_files;
CREATE POLICY work_task_review_files_insert ON work_task_review_files FOR INSERT
  WITH CHECK (app_can_access_work_task(task_id));

DROP POLICY IF EXISTS work_task_review_files_delete ON work_task_review_files;
CREATE POLICY work_task_review_files_delete ON work_task_review_files FOR DELETE
  USING (app_can_access_work_task(task_id));
