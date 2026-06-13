-- ════════════════════════════════════════════════════════════════════════════
-- Email Alerts — debounce log + per-member notification preferences
-- Date: 2026-06-13
--
-- Supports event-driven alert emails (see src/services/email.service.ts):
--   • email_alert_log         — dedupe/debounce so members aren't spammed when
--                               several chat messages land in quick succession.
--   • notification_preferences — per-(user, workspace) opt-out + unsubscribe
--                               token for non-transactional alerts (EMAIL.md).
--
-- Both tables are written exclusively by the service role from API routes
-- (the chat-alert webhook and the unsubscribe endpoint). RLS denies all
-- anon/authenticated access except a member reading/updating their OWN prefs.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Debounce log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_alert_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT        NOT NULL,
  alert_type      TEXT        NOT NULL,            -- e.g. 'chat_message'
  ref_id          UUID        NOT NULL,            -- e.g. internal_messages.channel_id
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Lookup pattern: "was <recipient> alerted for <type>/<ref> since <cutoff>?"
CREATE INDEX IF NOT EXISTS idx_alert_log_lookup
  ON email_alert_log (recipient_email, alert_type, ref_id, sent_at DESC);

ALTER TABLE email_alert_log ENABLE ROW LEVEL SECURITY;
-- No policies → service role only. Deny all anon/authenticated access.

-- ── Notification preferences ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id      UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chat_messages     BOOLEAN     NOT NULL DEFAULT true,
  unsubscribe_token UUID        NOT NULL DEFAULT gen_random_uuid(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workspace_id)
);
-- Unsubscribe links resolve a recipient by token alone — must be unique + indexed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_prefs_token
  ON notification_preferences (unsubscribe_token);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- A member can read their own preference row.
DROP POLICY IF EXISTS notif_prefs_select ON notification_preferences;
CREATE POLICY notif_prefs_select ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

-- A member can update their own preference row (e.g. toggle alerts in settings).
DROP POLICY IF EXISTS notif_prefs_update ON notification_preferences;
CREATE POLICY notif_prefs_update ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Inserts (default-on row creation) and token-based unsubscribe go through the
-- service role in the API, which bypasses RLS — no INSERT policy needed.

-- ════════════════════════════════════════════════════════════════════════════
-- Webhook wiring (manual, one-time):
--   Supabase Dashboard → Database → Webhooks → "Create a new hook"
--     Table:   internal_messages
--     Events:  INSERT
--     Type:    HTTP Request → POST
--     URL:     https://<your-app-host>/api/v1/internal/messages/notify
--     Headers: x-webhook-secret: <EMAIL_WEBHOOK_SECRET>
--
-- Equivalent pg_net trigger (uncomment + set the URL/secret if you prefer SQL):
--
--   CREATE OR REPLACE FUNCTION notify_internal_message() RETURNS trigger
--   LANGUAGE plpgsql SECURITY DEFINER AS $fn$
--   BEGIN
--     PERFORM net.http_post(
--       url     := 'https://<your-app-host>/api/v1/internal/messages/notify',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-webhook-secret', '<EMAIL_WEBHOOK_SECRET>'),
--       body    := jsonb_build_object('type','INSERT','record', to_jsonb(NEW))
--     );
--     RETURN NEW;
--   END $fn$;
--
--   CREATE TRIGGER trg_notify_internal_message
--     AFTER INSERT ON internal_messages
--     FOR EACH ROW EXECUTE FUNCTION notify_internal_message();
-- ════════════════════════════════════════════════════════════════════════════
