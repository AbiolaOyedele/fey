-- ════════════════════════════════════════════════════════════════════════════
-- Team Workspaces + Internal Chat (Playground)  — Phase 1
-- Date: 2026-06-13
--
-- Introduces a real team layer on top of the existing per-owner model:
--   • workspaces          — a team. Backfilled 1:1 from existing owners.
--   • workspace_members   — which auth users belong to a workspace + their role.
--   • workspace_invites   — email invites (own Supabase login).
--   • internal_channels   — chat rooms for the "Internal Chats (Playground)".
--   • internal_messages   — messages within a channel.
--
-- IMPORTANT: This migration is ADDITIVE. It does NOT alter RLS on any existing
-- table (crm_contacts, crm_messages, invoices, …). Extending those to
-- workspace-membership access is Phase 2, done separately and carefully.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Role enum ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL DEFAULT 'My workspace',
  slug       TEXT,
  owner_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces (slug) WHERE slug IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_workspaces_owner ON workspaces (owner_id);

CREATE TABLE IF NOT EXISTS workspace_members (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID           NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         workspace_role NOT NULL DEFAULT 'member',
  -- Denormalized identity for display (auth.users isn't readable via anon RLS).
  email        TEXT,
  name         TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_members_ws   ON workspace_members (workspace_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID           NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        TEXT           NOT NULL,
  role         workspace_role NOT NULL DEFAULT 'member',
  token        TEXT           NOT NULL UNIQUE,
  invited_by   UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT           NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  accepted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_pending_email
  ON workspace_invites (workspace_id, lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invites_email ON workspace_invites (lower(email)) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS internal_channels (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  created_by   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channels_ws ON internal_channels (workspace_id);

CREATE TABLE IF NOT EXISTS internal_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID        NOT NULL REFERENCES internal_channels(id) ON DELETE CASCADE,
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_internal_msgs_channel ON internal_messages (channel_id, created_at);

-- ── Membership helpers (SECURITY DEFINER avoids RLS recursion) ─────────────────

CREATE OR REPLACE FUNCTION app_is_workspace_member(ws UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION app_workspace_role(ws UUID)
RETURNS workspace_role LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM workspace_members
  WHERE workspace_id = ws AND user_id = auth.uid();
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

-- workspaces: members can read; only the owner can update/delete.
DROP POLICY IF EXISTS workspaces_select ON workspaces;
CREATE POLICY workspaces_select ON workspaces FOR SELECT
  USING (app_is_workspace_member(id) OR owner_id = auth.uid());
DROP POLICY IF EXISTS workspaces_update ON workspaces;
CREATE POLICY workspaces_update ON workspaces FOR UPDATE
  USING (owner_id = auth.uid());

-- workspace_members: members can read the roster; admins/owner manage it.
DROP POLICY IF EXISTS members_select ON workspace_members;
CREATE POLICY members_select ON workspace_members FOR SELECT
  USING (app_is_workspace_member(workspace_id));
DROP POLICY IF EXISTS members_manage ON workspace_members;
CREATE POLICY members_manage ON workspace_members FOR ALL
  USING (app_workspace_role(workspace_id) IN ('owner','admin'))
  WITH CHECK (app_workspace_role(workspace_id) IN ('owner','admin'));

-- workspace_invites: members can see pending invites; admins/owner manage.
-- (Creation + token-based acceptance go through the service role in the API.)
DROP POLICY IF EXISTS invites_select ON workspace_invites;
CREATE POLICY invites_select ON workspace_invites FOR SELECT
  USING (app_is_workspace_member(workspace_id));
DROP POLICY IF EXISTS invites_manage ON workspace_invites;
CREATE POLICY invites_manage ON workspace_invites FOR ALL
  USING (app_workspace_role(workspace_id) IN ('owner','admin'))
  WITH CHECK (app_workspace_role(workspace_id) IN ('owner','admin'));

-- internal_channels: any member reads; members create; admins/owner/creator delete.
DROP POLICY IF EXISTS channels_select ON internal_channels;
CREATE POLICY channels_select ON internal_channels FOR SELECT
  USING (app_is_workspace_member(workspace_id));
DROP POLICY IF EXISTS channels_insert ON internal_channels;
CREATE POLICY channels_insert ON internal_channels FOR INSERT
  WITH CHECK (app_is_workspace_member(workspace_id) AND created_by = auth.uid());
DROP POLICY IF EXISTS channels_delete ON internal_channels;
CREATE POLICY channels_delete ON internal_channels FOR DELETE
  USING (app_workspace_role(workspace_id) IN ('owner','admin') OR created_by = auth.uid());

-- internal_messages: any member reads; members send as themselves; sender/admin delete.
DROP POLICY IF EXISTS imsgs_select ON internal_messages;
CREATE POLICY imsgs_select ON internal_messages FOR SELECT
  USING (app_is_workspace_member(workspace_id));
DROP POLICY IF EXISTS imsgs_insert ON internal_messages;
CREATE POLICY imsgs_insert ON internal_messages FOR INSERT
  WITH CHECK (app_is_workspace_member(workspace_id) AND sender_id = auth.uid());
DROP POLICY IF EXISTS imsgs_delete ON internal_messages;
CREATE POLICY imsgs_delete ON internal_messages FOR DELETE
  USING (sender_id = auth.uid() OR app_workspace_role(workspace_id) IN ('owner','admin'));

-- ── Realtime ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE internal_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Backfill: every existing owner → a workspace, themselves as 'owner' ────────

INSERT INTO workspaces (name, slug, owner_id)
SELECT COALESCE(NULLIF(fs.workspace_name, ''), NULLIF(fs.company_name, ''), 'My workspace'),
       fs.workspace_slug,
       fs.user_id
FROM fey_settings fs
WHERE fs.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.owner_id = fs.user_id);

INSERT INTO workspace_members (workspace_id, user_id, role, email, name)
SELECT w.id, w.owner_id, 'owner',
       u.email,
       COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1))
FROM workspaces w
LEFT JOIN auth.users u ON u.id = w.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members m
  WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
);

-- Seed a default "general" channel so the Playground isn't empty.
INSERT INTO internal_channels (workspace_id, name, created_by)
SELECT w.id, 'general', w.owner_id
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM internal_channels c WHERE c.workspace_id = w.id);
