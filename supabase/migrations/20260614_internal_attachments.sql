-- ════════════════════════════════════════════════════════════════════════════
-- Internal chat: file attachments
-- Date: 2026-06-14
--
-- Adds an attachments column to internal_messages so the Playground supports
-- files/images like the client message thread. Shape mirrors crm_messages:
--   [{ file_name, file_url, file_type, file_size }]
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE internal_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';
