-- ════════════════════════════════════════════════════════════════════════════
-- In-app notifications (recipient-based) + Web Push subscriptions
-- Date: 2026-06-20
--
-- Replaces the owner-only crm_notifications model with a per-recipient table so
-- teammates get the notifications relevant to them (a task assigned to you, a
-- client message, project activity, etc.). Rows are created server-side with the
-- service role (notifications.service.ts), so no INSERT policy is granted.
-- Recipients read/clear only their own.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  body         TEXT,
  link         TEXT,
  entity_type  TEXT,
  entity_id    UUID,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications (recipient_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
DROP POLICY IF EXISTS notifications_delete ON notifications;
CREATE POLICY notifications_delete ON notifications FOR DELETE USING (recipient_id = auth.uid());

-- Deliver new rows to the recipient in realtime (in-app toast/badge).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE notifications';
  END IF;
END $$;

-- ── Web Push subscriptions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_all ON push_subscriptions;
CREATE POLICY push_subscriptions_all ON push_subscriptions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
