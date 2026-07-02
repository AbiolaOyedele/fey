-- ════════════════════════════════════════════════════════════════════════════
-- Internal chat message edit/delete
-- Date: 2026-07-02
--
-- DELETE already existed (sender or workspace admin, imsgs_delete in
-- 20260613_team_workspaces.sql). This adds UPDATE — sender only, and only the
-- body/edited_at columns (WITH CHECK re-pins channel_id/workspace_id/sender_id
-- so an edit can't be used to move a message into a different channel or
-- reassign its sender).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

DROP POLICY IF EXISTS imsgs_update ON internal_messages;
CREATE POLICY imsgs_update ON internal_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
