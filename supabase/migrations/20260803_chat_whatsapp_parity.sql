-- ════════════════════════════════════════════════════════════════════════════
-- Chat — WhatsApp-style parity across all three conversations
-- Date: 2026-08-03
--
-- Additive and idempotent. Safe to re-run.
--
-- Covers internal chat (staff), CRM messages (agency <-> client), and a new
-- private team chat for the client portal. Clients mostly come from WhatsApp,
-- so the behaviour here follows WhatsApp's, including its windows:
--
--   • unsend ("delete for everyone")  — 48h after sending
--   • edit                            — 15 min after sending, marked "Edited"
--
-- The windows are enforced in the service layer, not here: a CHECK constraint
-- comparing against now() can't be re-evaluated on update, and baking the
-- policy into SQL would mean a migration every time the product changes it.
--
-- DELETES ARE SOFT. Internal chat previously hard-deleted, which is the one
-- thing WhatsApp does NOT do — the row vanished and the conversation silently
-- closed up, so nobody could tell whether a message was removed or never sent.
-- A tombstone row keeps "This message was deleted" in place, and keeps replies
-- that quote it coherent.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Soft delete, edit and reply on both existing message tables ──────────

ALTER TABLE internal_messages
  ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ,
  -- NULL for a self-delete ("delete for me"); set when it was unsent for all.
  ADD COLUMN IF NOT EXISTS deleted_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_id  UUID REFERENCES internal_messages(id) ON DELETE SET NULL;

ALTER TABLE crm_messages
  ADD COLUMN IF NOT EXISTS edited_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ,
  -- Either an auth user (owner side) or a portal user (client side), so this is
  -- deliberately NOT a foreign key — the two id spaces are disjoint.
  ADD COLUMN IF NOT EXISTS deleted_by   UUID,
  ADD COLUMN IF NOT EXISTS reply_to_id  UUID REFERENCES crm_messages(id) ON DELETE SET NULL;

-- Reply lookups: fetching a thread pulls each quoted parent by id.
CREATE INDEX IF NOT EXISTS idx_internal_msgs_reply ON internal_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_msgs_reply      ON crm_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- ── 2. "Delete for me" ──────────────────────────────────────────────────────
-- WhatsApp has two deletes. "For everyone" is the tombstone above. "For me"
-- hides the message for one person only, so it can't live on the message row —
-- it's per-viewer. Viewer ids come from two disjoint spaces (auth users and
-- portal users), hence a plain UUID rather than a foreign key.

CREATE TABLE IF NOT EXISTS message_hidden (
  message_id  UUID        NOT NULL,
  -- 'internal' | 'crm' | 'portal_team' — which table message_id points at.
  scope       TEXT        NOT NULL,
  viewer_id   UUID        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, scope, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_message_hidden_viewer ON message_hidden (viewer_id, scope);

ALTER TABLE message_hidden ENABLE ROW LEVEL SECURITY;

-- Auth users manage their own hides directly. Portal users go through an API
-- route on the service role, since they have no auth.uid().
DROP POLICY IF EXISTS message_hidden_own ON message_hidden;
CREATE POLICY message_hidden_own ON message_hidden FOR ALL
  USING (viewer_id = auth.uid())
  WITH CHECK (viewer_id = auth.uid());

-- ── 3. Reactions ────────────────────────────────────────────────────────────
-- One row per (message, scope, reactor). Re-tapping the same emoji deletes the
-- row; a different emoji replaces it — matching WhatsApp, where a person holds
-- exactly one reaction per message.

CREATE TABLE IF NOT EXISTS message_reactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID        NOT NULL,
  scope       TEXT        NOT NULL,
  reactor_id  UUID        NOT NULL,
  -- Display name captured at reaction time: portal users and auth users live in
  -- different tables, so there's no single join that resolves both.
  reactor_name TEXT       NOT NULL DEFAULT '',
  emoji       TEXT        NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, scope, reactor_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions (scope, message_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone signed in may read reactions; you may only write your own. Reading is
-- gated in practice by whether you can see the message at all.
DROP POLICY IF EXISTS message_reactions_select ON message_reactions;
CREATE POLICY message_reactions_select ON message_reactions FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS message_reactions_own ON message_reactions;
CREATE POLICY message_reactions_own ON message_reactions FOR ALL
  USING (reactor_id = auth.uid())
  WITH CHECK (reactor_id = auth.uid());

-- ── 4. Portal team chat ─────────────────────────────────────────────────────
-- The client's own private conversation, between their portal members only.
-- The agency cannot read it: there is no owner-side SELECT policy, and every
-- read goes through a portal-authenticated API route. This is the client's
-- equivalent of the staff internal chat.

CREATE TABLE IF NOT EXISTS portal_team_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The conversation is per CONTACT: everyone with portal access to the same
  -- contact shares one room.
  contact_id  UUID        NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  attachments JSONB       NOT NULL DEFAULT '[]',
  reply_to_id UUID        REFERENCES portal_team_messages(id) ON DELETE SET NULL,
  edited_at   TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_team_msgs_contact
  ON portal_team_messages (contact_id, created_at);

ALTER TABLE portal_team_messages ENABLE ROW LEVEL SECURITY;

-- Deliberately NO policy. Portal users have no auth.uid() to match on, and the
-- agency must not be able to read this table — so nothing reaches it except the
-- service role, behind a route that verifies the portal JWT. An owner-side
-- policy here would quietly defeat the entire point of the feature.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'portal_team_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_team_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;

-- ── 5. Internal chat delete policy ──────────────────────────────────────────
-- The old policy allowed a hard DELETE. Deletes now go through UPDATE (setting
-- deleted_at), so the update policy has to permit a sender to tombstone their
-- own message, and a workspace admin to remove anyone's — the same authority
-- WhatsApp gives a group admin.

DROP POLICY IF EXISTS imsgs_update ON internal_messages;
CREATE POLICY imsgs_update ON internal_messages FOR UPDATE
  USING (sender_id = auth.uid() OR app_workspace_role(workspace_id) IN ('owner', 'super_admin', 'admin'))
  WITH CHECK (sender_id = auth.uid() OR app_workspace_role(workspace_id) IN ('owner', 'super_admin', 'admin'));

COMMENT ON COLUMN internal_messages.deleted_at IS
  'Tombstone. The row stays so the thread still reads correctly and replies quoting it stay coherent.';
COMMENT ON TABLE portal_team_messages IS
  'The client team''s private chat. The agency cannot read it — service role only, behind a portal-authenticated route.';
