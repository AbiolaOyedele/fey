-- ════════════════════════════════════════════════════════════════════════════
-- Portal members — revoke access without destroying the person's history
-- Date: 2026-08-08
--
-- Removing someone was all-or-nothing: delete the row, and everything hanging
-- off it went too. That is the wrong default for the common case, which is
-- "they've left the project" rather than "they were never meant to exist".
--
-- revoked_at IS NULL      → active.
-- revoked_at IS NOT NULL  → access is cut off everywhere, immediately, but the
--                           row survives. Their messages, uploads, comments and
--                           signatures stay attached to a real name, and access
--                           can be handed back without re-inviting them.
--
-- Deleting is still available for a row that should never have existed. Part 2
-- below makes that safe as well.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Revocation ───────────────────────────────────────────────────────────

ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  -- Display label for who cut the access off: the client's own admin by name,
  -- or the agency. Free text on purpose — it is a record of what happened, and
  -- must not break or change meaning if that admin is later removed.
  ADD COLUMN IF NOT EXISTS revoked_by TEXT;

-- Every authenticated portal request checks this column, so it is the hottest
-- lookup in the portal. Partial: only revoked rows need finding this way, and
-- they are the rare case.
CREATE INDEX IF NOT EXISTS idx_portal_users_revoked
  ON portal_users (id)
  WHERE revoked_at IS NOT NULL;

COMMENT ON COLUMN portal_users.revoked_at IS
  'When this person''s portal access was cut off. NULL means active. Checked on every authenticated portal request, so revocation takes effect immediately rather than when their 30-day token expires.';

COMMENT ON COLUMN portal_users.revoked_by IS
  'Display label for who revoked the access — the client admin''s name, or the agency. Deliberately free text: this is a historical record and must survive that person being removed.';

-- ── 2. Deleting a member must not delete the client's conversation ──────────
--
-- portal_team_messages.sender_id was NOT NULL REFERENCES portal_users
-- ON DELETE CASCADE. Removing one person therefore erased their side of the
-- client's private team chat — the other participants lost half a conversation
-- they still had every right to read, with no warning and no way back.
--
-- The sender becomes nullable and the FK becomes SET NULL, so the message
-- survives its author. The read path already falls back to a generic name when
-- a sender can't be resolved, so an orphaned message renders as "Removed
-- member" instead of vanishing.

ALTER TABLE portal_team_messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE portal_team_messages
  DROP CONSTRAINT IF EXISTS portal_team_messages_sender_id_fkey;

ALTER TABLE portal_team_messages
  ADD CONSTRAINT portal_team_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES portal_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN portal_team_messages.sender_id IS
  'Who wrote it. NULL once that portal user has been deleted — the message is kept because the rest of the room still needs the conversation to make sense.';
