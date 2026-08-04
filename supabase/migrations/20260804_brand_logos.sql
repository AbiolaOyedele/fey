-- ════════════════════════════════════════════════════════════════════════════
-- Brand logos, and a chat-delete policy that knows about super_admin
-- Date: 2026-08-04
--
--   1. projects.logo_url / logo_public_id — a brand is a real client's brand,
--      and every one of them already has a logo. Showing a generic sparkle icon
--      instead made the Brands grid read as placeholder UI. The public_id is
--      stored alongside the URL so replacing or clearing a logo can delete the
--      old Cloudinary asset rather than orphaning it.
--
--   2. imsgs_delete — the internal-chat delete policy predates the `super_admin`
--      role and still lists only ('owner','admin'). A super_admin could see the
--      Clear chat control and have the write silently refused, which is the
--      worst of both. Same fix as the other policies took when the role landed.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Brand logos ──────────────────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS logo_url       TEXT,
  ADD COLUMN IF NOT EXISTS logo_public_id TEXT;

COMMENT ON COLUMN projects.logo_url IS
  'Cloudinary URL of the brand logo. Null falls back to the brand''s initial.';
COMMENT ON COLUMN projects.logo_public_id IS
  'Cloudinary public_id for logo_url, so a replaced logo can be destroyed.';

-- ── 2. Internal chat: super_admin may clear a channel ───────────────────────
DROP POLICY IF EXISTS imsgs_delete ON internal_messages;
CREATE POLICY imsgs_delete ON internal_messages FOR DELETE
  USING (
    sender_id = auth.uid()
    OR app_workspace_role(workspace_id) IN ('owner', 'super_admin', 'admin')
  );
