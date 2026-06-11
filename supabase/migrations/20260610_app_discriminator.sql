-- Add app discriminator to tables that are missing it.
-- Run this once in the Supabase SQL editor.
-- Existing rows default to 'fey' — safe for the current dataset.

-- 1. trash
ALTER TABLE trash ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'fey';
CREATE INDEX IF NOT EXISTS trash_app_user_idx ON trash (user_id, app, deleted_at DESC);

-- 2. app_settings  (key-value store — onConflict target must include app)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'fey';
-- The upsert conflict target was (key, user_id); now it must be (key, user_id, app)
-- Drop old unique constraint if it exists and add the new one
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_key_user_id_key;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_key_user_id_app_key UNIQUE (key, user_id, app);

-- 3. user_settings
-- This is a single-row-per-user table with Fey-specific columns.
-- Adding app lets us isolate rows if the other project ever writes here.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'fey';
CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_app_key ON user_settings (user_id, app);
