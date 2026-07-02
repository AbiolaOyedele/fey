-- ════════════════════════════════════════════════════════════════════════════
-- @Mentions (notify-once ledger)
-- Date: 2026-07-03
--
-- Records which user was mentioned in which entity (a task description, a
-- subtask, an internal chat message, or a CRM client message) so we notify
-- once per mention, not once per save. The unique constraint is the dedup
-- mechanism: inserts use ON CONFLICT DO NOTHING RETURNING, so re-saving a
-- task description that still contains "@Jane" doesn't re-notify her, but
-- adding "@Mike" later does.
--
-- Written only by the service role (mentions.service.ts via /api/v1/mentions).
-- Nothing reads this table from the client, so RLS is enabled with zero
-- policies — the same lockdown style as `notifications` (20260620_notifications.sql).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mentions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type      TEXT        NOT NULL CHECK (entity_type IN ('task_description', 'subtask', 'internal_message', 'crm_message')),
  entity_id        UUID        NOT NULL,
  mentioned_user_id UUID       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_by     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user ON mentions (mentioned_user_id, created_at DESC);

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
-- No policies: service role (which bypasses RLS) is the only writer/reader.
