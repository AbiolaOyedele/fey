-- ════════════════════════════════════════════════════════════════════════════
-- Playground · Ruff Tools — saved watermarks (ruff_watermarks)
-- Date: 2026-07-30
--
-- The Watermarker tool lets a workspace save reusable watermark images (logos,
-- stamps) so they don't have to be re-uploaded each time. The binary lives in
-- Cloudinary (signed upload, same as social_post_files); this table stores the
-- metadata row pointing back at it.
--
-- Visibility: workspace-shared, mirroring the Social Corner. RLS reuses the
-- SECURITY DEFINER helpers app_can_access_owner (any workspace member) /
-- app_can_manage_owner (owner + admin). Any member can save, rename and remove
-- watermarks from the shared library.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ruff_watermarks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by   UUID        NOT NULL REFERENCES auth.users(id),

  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  -- Cloudinary delivery URL + public_id (for later cleanup).
  image_url    TEXT        NOT NULL CHECK (image_url ~ '^https://res\.cloudinary\.com/'),
  public_id    TEXT        NOT NULL CHECK (char_length(public_id) BETWEEN 1 AND 300),
  width        INTEGER     CHECK (width IS NULL OR width > 0),
  height       INTEGER     CHECK (height IS NULL OR height > 0),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ruff_watermarks_owner ON ruff_watermarks (owner_id) WHERE deleted_at IS NULL;

-- updated_at is maintained by the repository layer (codebase convention).

-- ── RLS ─────────────────────────────────────────────────────────────────────────
ALTER TABLE ruff_watermarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY ruff_watermarks_select ON ruff_watermarks FOR SELECT
  USING (app_can_access_owner(owner_id));
CREATE POLICY ruff_watermarks_insert ON ruff_watermarks FOR INSERT
  WITH CHECK (app_can_access_owner(owner_id) AND created_by = auth.uid());
CREATE POLICY ruff_watermarks_update ON ruff_watermarks FOR UPDATE
  USING (app_can_access_owner(owner_id))
  WITH CHECK (app_can_access_owner(owner_id));
CREATE POLICY ruff_watermarks_delete ON ruff_watermarks FOR DELETE
  USING (app_can_access_owner(owner_id));
