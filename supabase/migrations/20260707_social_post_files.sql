-- ════════════════════════════════════════════════════════════════════════════
-- Social Corner post attachments (social_posts)
-- Date: 2026-07-07
--
-- Files uploaded to Cloudinary and attached to social_posts — inspiration
-- images/files for a post. Metadata only — binaries live in Cloudinary under
-- fey/social-posts/<post_id>/. Same shape and visibility model as
-- work_task_files (20260702_work_task_files.sql): workspace-shared via
-- app_can_access_owner, resolved through the parent post's owner_id.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS social_post_files (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID        NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by   UUID,
  uploader_name TEXT,
  file_name     TEXT        NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 300),
  file_url      TEXT        NOT NULL,
  public_id     TEXT        NOT NULL,
  file_size     INTEGER     CHECK (file_size IS NULL OR file_size >= 0),
  file_type     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_post_files_post ON social_post_files (post_id, created_at DESC);

ALTER TABLE social_post_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_post_files_select ON social_post_files;
CREATE POLICY social_post_files_select ON social_post_files FOR SELECT
  USING (app_can_access_owner(owner_id));

DROP POLICY IF EXISTS social_post_files_insert ON social_post_files;
CREATE POLICY social_post_files_insert ON social_post_files FOR INSERT
  WITH CHECK (app_can_access_owner(owner_id) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS social_post_files_delete ON social_post_files;
CREATE POLICY social_post_files_delete ON social_post_files FOR DELETE
  USING (app_can_access_owner(owner_id));
