-- ════════════════════════════════════════════════════════════════════════════
-- Projects: allow personal (unassigned) projects
-- Date: 2026-06-19
--
-- Projects can now be created without a client. A NULL contact_id means a
-- personal project: it appears in the central Projects hub and is workspace-
-- visible, but never surfaces on any client page or client portal (those
-- queries all filter by contact_id). Client-assigned projects are unchanged.
--
-- RLS is already workspace-scoped via app_can_access_owner(owner_id) and the
-- portal reads filter by contact_id, so no policy changes are needed — only the
-- NOT NULL constraint is dropped.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE projects ALTER COLUMN contact_id DROP NOT NULL;
