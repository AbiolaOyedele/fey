-- ════════════════════════════════════════════════════════════════════════════
-- Task review — upload first, send for review second
-- Date: 2026-08-07  (follows 20260807_task_review_multi_file.sql)
--
-- Uploading and submitting were the same act, so a wrong file was immediately
-- the deliverable, immediately superseded the previous version, and immediately
-- notified everyone. Splitting them gives you a staging step: upload, check it,
-- remove what shouldn't be there, then send.
--
-- submitted_at IS NULL  → a draft. Private to the side that made it, not
--                         reviewable, doesn't supersede anything, doesn't count
--                         toward the three-version cap, freely deletable.
-- submitted_at IS NOT   → sent for review. Locked: it can only be deleted once
--                         a newer version has replaced it.
--
-- Everything already uploaded predates the split and was, by definition, sent
-- the moment it landed — so existing rows are backfilled as submitted.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE work_task_reviews
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

UPDATE work_task_reviews
   SET submitted_at = created_at
 WHERE submitted_at IS NULL;

-- Finding a task's open draft is the hot path on the Review tab; there is at
-- most one per side, so this stays tiny.
CREATE INDEX IF NOT EXISTS idx_work_task_reviews_draft
  ON work_task_reviews (task_id)
  WHERE submitted_at IS NULL;

COMMENT ON COLUMN work_task_reviews.submitted_at IS
  'When this version was sent for review. NULL means it is still a draft: visible only to the side that uploaded it, not reviewable, and deletable. Once set, the version can only be deleted after a newer one supersedes it.';
