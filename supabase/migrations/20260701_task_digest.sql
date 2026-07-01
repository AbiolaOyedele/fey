-- ════════════════════════════════════════════════════════════════════════════
-- Daily task digest — per-user opt-out + send log
-- Date: 2026-07-01
--
-- Supports the daily digest email (src/services/task-digest.service.ts):
--   • fey_settings.task_digest_enabled — per-user on/off toggle (Settings → App)
--   • daily_digest_log                 — dedupe so a user is never emailed twice
--                                        for the same day if the cron reruns.
--
-- daily_digest_log is written exclusively by the service role from the cron
-- route. RLS denies all anon/authenticated access — no policies needed, same
-- pattern as email_alert_log (20260613_email_alerts.sql).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE fey_settings ADD COLUMN IF NOT EXISTS task_digest_enabled TEXT NOT NULL DEFAULT 'true';

CREATE TABLE IF NOT EXISTS daily_digest_log (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_date DATE NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, digest_date)
);

ALTER TABLE daily_digest_log ENABLE ROW LEVEL SECURITY;
-- No policies → service role only. Deny all anon/authenticated access.
