-- ════════════════════════════════════════════════════════════════════════════
-- CRM Module Migration
-- Creates all tables for the new CRM, client portal, messaging, contracts,
-- and forms system. Replaces the old clients page pattern.
-- ════════════════════════════════════════════════════════════════════════════

-- ── CRM Contacts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_contacts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  company               TEXT,
  avatar_url            TEXT,
  status                TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'idle', 'completed')),
  portal_enabled        BOOLEAN     NOT NULL DEFAULT false,
  portal_welcome_message TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ── Portal Users ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portal_users (
  id          UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  UUID  NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id    UUID  NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  name        TEXT  NOT NULL,
  email       TEXT  NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Messages ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id),
  sender_type TEXT        NOT NULL CHECK (sender_type IN ('owner', 'client')),
  sender_id   UUID        NOT NULL REFERENCES auth.users(id),
  body        TEXT        NOT NULL,
  body_html   TEXT,
  attachments JSONB       DEFAULT '[]',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Files ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_files (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID    NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id      UUID    NOT NULL REFERENCES auth.users(id),
  uploaded_by   UUID    NOT NULL REFERENCES auth.users(id),
  uploader_type TEXT    NOT NULL CHECK (uploader_type IN ('owner', 'client')),
  file_name     TEXT    NOT NULL,
  file_url      TEXT    NOT NULL,
  public_id     TEXT    NOT NULL,
  file_size     INTEGER,
  file_type     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Contracts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_contracts (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID  NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id    UUID  NOT NULL REFERENCES auth.users(id),
  title       TEXT  NOT NULL,
  share_token TEXT  NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status      TEXT  NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'signed', 'declined')),
  content     JSONB NOT NULL DEFAULT '{}',
  signed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Forms ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_forms (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   UUID  NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id     UUID  NOT NULL REFERENCES auth.users(id),
  title        TEXT  NOT NULL,
  share_token  TEXT  NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status       TEXT  NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'submitted')),
  fields       JSONB NOT NULL DEFAULT '[]',
  responses    JSONB DEFAULT '[]',
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Notifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_notifications (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  UUID  REFERENCES crm_contacts(id) ON DELETE SET NULL,
  type        TEXT  NOT NULL,
  message     TEXT  NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE crm_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_files        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contracts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_forms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notifications ENABLE ROW LEVEL SECURITY;

-- crm_contacts
CREATE POLICY "owner_contacts" ON crm_contacts
  FOR ALL USING (owner_id = auth.uid());

-- portal_users
CREATE POLICY "owner_portal_users" ON portal_users
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "portal_user_self" ON portal_users
  FOR SELECT USING (id = auth.uid());

-- crm_messages
CREATE POLICY "owner_messages" ON crm_messages
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "client_messages_select" ON crm_messages
  FOR SELECT USING (
    contact_id IN (
      SELECT contact_id FROM portal_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "client_send_message" ON crm_messages
  FOR INSERT WITH CHECK (
    contact_id IN (
      SELECT contact_id FROM portal_users WHERE id = auth.uid()
    )
    AND sender_id = auth.uid()
    AND sender_type = 'client'
  );

-- crm_files
CREATE POLICY "owner_files" ON crm_files
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "client_files_select" ON crm_files
  FOR SELECT USING (
    contact_id IN (
      SELECT contact_id FROM portal_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "client_files_insert" ON crm_files
  FOR INSERT WITH CHECK (
    contact_id IN (
      SELECT contact_id FROM portal_users WHERE id = auth.uid()
    )
    AND uploaded_by = auth.uid()
    AND uploader_type = 'client'
  );

-- crm_contracts
CREATE POLICY "owner_contracts" ON crm_contracts
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "client_contracts_select" ON crm_contracts
  FOR SELECT USING (
    status IN ('sent', 'signed', 'declined')
    AND contact_id IN (
      SELECT contact_id FROM portal_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "client_contracts_sign" ON crm_contracts
  FOR UPDATE USING (
    status = 'sent'
    AND contact_id IN (
      SELECT contact_id FROM portal_users WHERE id = auth.uid()
    )
  );

-- crm_forms
CREATE POLICY "owner_forms" ON crm_forms
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "client_forms_select" ON crm_forms
  FOR SELECT USING (
    status IN ('sent', 'submitted')
    AND contact_id IN (
      SELECT contact_id FROM portal_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "client_forms_submit" ON crm_forms
  FOR UPDATE USING (
    status = 'sent'
    AND contact_id IN (
      SELECT contact_id FROM portal_users WHERE id = auth.uid()
    )
  );

-- crm_notifications
CREATE POLICY "owner_notifications" ON crm_notifications
  FOR ALL USING (owner_id = auth.uid());

-- ── Subdomain column on user_settings ─────────────────────────────────────────

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS portal_subdomain TEXT UNIQUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS portal_active    BOOLEAN NOT NULL DEFAULT false;

-- ── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE crm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_notifications;

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_contacts_updated_at
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER crm_contracts_updated_at
  BEFORE UPDATE ON crm_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER crm_forms_updated_at
  BEFORE UPDATE ON crm_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
