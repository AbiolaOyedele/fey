-- ════════════════════════════════════════════════════════════════════════════
-- Client Portal — notifications for portal users
-- Date: 2026-08-02
--
-- Additive and idempotent. Safe to re-run.
--
-- The app already notifies the OWNER about client activity (the `notifications`
-- table). Nothing ever notified the CLIENT. This adds that direction.
--
-- Why a separate table rather than reusing `notifications`:
-- `notifications.recipient_id` is `REFERENCES auth.users(id)`, and portal users
-- are NOT auth users — `portal_users.id` is a standalone UUID with its own
-- custom-JWT login. Pointing that column at a portal user would violate the FK
-- on every insert. Same shape, different recipient domain.
--
-- Access follows the rest of the portal: RLS is on with no client-facing
-- policy, and every read/write goes through an API route that verifies the
-- portal JWT (requirePortalAuth) and then uses the service role. The owner
-- policy below exists so the owner can see what their client was told.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portal_notifications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who sees it.
  portal_user_id UUID        NOT NULL REFERENCES portal_users(id)  ON DELETE CASCADE,
  -- Denormalised scope: lets the owner query "everything I sent this client"
  -- without a join, and survives a portal user being recreated.
  contact_id     UUID        REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id       UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  type           TEXT        NOT NULL,
  title          TEXT        NOT NULL,
  body           TEXT,
  -- Portal-relative path, e.g. '/messages' — resolved against the portal base
  -- at render time so it works on both /client/* and /portal/<slug>/*.
  link           TEXT,
  entity_type    TEXT,
  entity_id      UUID,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_notifications_recipient
  ON portal_notifications (portal_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_notifications_unread
  ON portal_notifications (portal_user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_portal_notifications_owner
  ON portal_notifications (owner_id, created_at DESC);

ALTER TABLE portal_notifications ENABLE ROW LEVEL SECURITY;

-- The owner may read what was sent to their own clients. Portal users have no
-- policy at all: they never touch this table with a user-scoped client.
DROP POLICY IF EXISTS portal_notifications_owner_select ON portal_notifications;
CREATE POLICY portal_notifications_owner_select ON portal_notifications FOR SELECT
  USING (owner_id = auth.uid());

-- ── Per-client notification preferences ─────────────────────────────────────
-- Which categories a client wants. Absent row = all on, so an existing client
-- keeps getting everything without a backfill.

CREATE TABLE IF NOT EXISTS portal_notification_prefs (
  portal_user_id UUID        PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
  owner_id       UUID        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  messages       BOOLEAN     NOT NULL DEFAULT TRUE,
  files          BOOLEAN     NOT NULL DEFAULT TRUE,
  contracts      BOOLEAN     NOT NULL DEFAULT TRUE,
  forms          BOOLEAN     NOT NULL DEFAULT TRUE,
  invoices       BOOLEAN     NOT NULL DEFAULT TRUE,
  tasks          BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE portal_notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_notification_prefs_owner_select ON portal_notification_prefs;
CREATE POLICY portal_notification_prefs_owner_select ON portal_notification_prefs FOR SELECT
  USING (owner_id = auth.uid());

-- ── Realtime ────────────────────────────────────────────────────────────────
-- So the portal bell increments the moment the owner sends something, with no
-- refresh. Guarded so re-running is safe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'portal_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_notifications;
  END IF;
END $$;
