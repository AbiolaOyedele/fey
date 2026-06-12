-- ============================================================
-- Migration: Message settings + portal activity
-- Date: 2026-06-12
--
-- Adds the columns behind three shipped features that are currently
-- dormant because their columns don't exist yet:
--   1. portal_users.last_seen_at       → "last active" + Active filter
--   2. fey_settings.portal_read_receipts → Settings → Messages toggle
--   3. fey_settings.message_retention_days → retention selector + cron
--
-- All idempotent (IF NOT EXISTS) — safe to run more than once.
-- ============================================================

ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE fey_settings
  ADD COLUMN IF NOT EXISTS portal_read_receipts   text NOT NULL DEFAULT 'true';

ALTER TABLE fey_settings
  ADD COLUMN IF NOT EXISTS message_retention_days text NOT NULL DEFAULT '60';
