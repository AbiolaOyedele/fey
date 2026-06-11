-- ═══════════════════════════════════════════════════════════════════════════
-- FEY-ONLY DATABASE MIGRATION
-- Run this on a fresh Supabase project (rwpyomkbzpmvbnbuduko) that has
-- NEVER had Workboard tables. Paste into the SQL editor at:
-- https://supabase.com/dashboard/project/rwpyomkbzpmvbnbuduko/sql/new
--
-- This script SKIPS all Workboard-dependent migrations:
--   ✗ 20260426_file_management.sql  — references tasks, clients
--   ✗ 20260427_client_campaigns.sql  — references clients
--   ✗ 20260427_campaigns_v2.sql      — references client_campaigns
--   ✗ 20260527_app_column.sql        — alters Workboard tables
--   ✗ 20260609_app_settings.sql      — Workboard key-value store
--   ✗ 20260609_shared_clients.sql    — handled inline below
--   ✗ 20260610_app_discriminator.sql — alters Workboard tables
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 0: FOUNDATIONAL TABLES
-- These existed in the old DB before any migration was written.
-- Creating them fresh here with the 'app' discriminator baked in.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── clients ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clients (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app               TEXT        NOT NULL DEFAULT 'fey',
  name              TEXT        NOT NULL DEFAULT '',
  color             TEXT        NOT NULL DEFAULT '#F0FDF4',
  logo              TEXT        NOT NULL DEFAULT '',
  email             TEXT        NOT NULL DEFAULT '',
  phone             TEXT        NOT NULL DEFAULT '',
  address           TEXT        NOT NULL DEFAULT '',
  website           TEXT        NOT NULL DEFAULT '',
  tax_id            TEXT        NOT NULL DEFAULT '',
  task_mode         BOOLEAN     NOT NULL DEFAULT false,
  retainer          NUMERIC     NOT NULL DEFAULT 0,
  retainer_currency TEXT        NOT NULL DEFAULT 'NGN',
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_owner_all" ON public.clients
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_clients_user_app
  ON public.clients(user_id, app, created_at DESC);

-- ── tasks ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app        TEXT        NOT NULL DEFAULT 'fey',
  title      TEXT        NOT NULL DEFAULT '',
  done       BOOLEAN     NOT NULL DEFAULT false,
  paid       BOOLEAN     NOT NULL DEFAULT false,
  amount     NUMERIC     NOT NULL DEFAULT 0,
  currency   TEXT        NOT NULL DEFAULT 'NGN',
  deadline   TEXT,                          -- stored as YYYY-MM-DD string or null
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_owner_all" ON public.tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_app
  ON public.tasks(user_id, app, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_tasks_client
  ON public.tasks(client_id);

-- ── task_groups ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_groups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app        TEXT        NOT NULL DEFAULT 'fey',
  name       TEXT        NOT NULL DEFAULT '',
  icon       TEXT        NOT NULL DEFAULT 'Star',
  color      TEXT        NOT NULL DEFAULT '#EDE9FE',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_groups_owner_all" ON public.task_groups
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_groups_user_app
  ON public.task_groups(user_id, app, sort_order ASC);

-- ── standalone_tasks ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.standalone_tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID        REFERENCES public.task_groups(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app        TEXT        NOT NULL DEFAULT 'fey',
  title      TEXT        NOT NULL DEFAULT '',
  done       BOOLEAN     NOT NULL DEFAULT false,
  deadline   TEXT,                          -- stored as YYYY-MM-DD string or null
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.standalone_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "standalone_tasks_owner_all" ON public.standalone_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_standalone_tasks_user_app
  ON public.standalone_tasks(user_id, app, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_standalone_tasks_group
  ON public.standalone_tasks(group_id);

-- ── retainer_payments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.retainer_payments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app        TEXT        NOT NULL DEFAULT 'fey',
  month      TEXT        NOT NULL,          -- YYYY-MM format
  paid       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, month)
);

ALTER TABLE public.retainer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retainer_payments_owner_all" ON public.retainer_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_retainer_payments_client
  ON public.retainer_payments(client_id, month);

-- ── trash ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trash (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app          TEXT        NOT NULL DEFAULT 'fey',
  entity_type  TEXT        NOT NULL,        -- 'client' | 'task' | 'invoice' etc.
  entity_id    UUID        NOT NULL,
  entity_data  JSONB       NOT NULL DEFAULT '{}',
  deleted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trash ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trash_owner_all" ON public.trash
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trash_user_app
  ON public.trash(user_id, app, deleted_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: 20260518_fey_tables.sql
-- fey_threads and fey_tasks (WhatsApp AI notes)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fey_threads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_message  TEXT        NOT NULL,
  heading      TEXT        NOT NULL,
  message_date DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fey_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fey_threads_select_own" ON public.fey_threads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fey_threads_insert_own" ON public.fey_threads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fey_threads_delete_own" ON public.fey_threads
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.fey_tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID        NOT NULL REFERENCES public.fey_threads(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  notes      TEXT,
  deadline   DATE,
  done       BOOLEAN     NOT NULL DEFAULT false,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fey_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fey_tasks_insert_own" ON public.fey_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fey_tasks_select_own" ON public.fey_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fey_tasks_update_own" ON public.fey_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "fey_tasks_delete_own" ON public.fey_tasks
  FOR DELETE USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: 20260518_whatsapp_bot.sql
-- WhatsApp connection and verification codes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT        NOT NULL,
  verified     BOOLEAN     NOT NULL DEFAULT false,
  connected_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_connections_select_own" ON public.whatsapp_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "whatsapp_connections_delete_own" ON public.whatsapp_connections
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.verification_codes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT        NOT NULL,
  code         TEXT        NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — service role key bypasses RLS.


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: 20260526_fey_realtime.sql
-- Enable Realtime on Fey tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fey_threads REPLICA IDENTITY FULL;
ALTER TABLE public.fey_tasks   REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'fey_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fey_threads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'fey_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fey_tasks;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: 20260526_fey_sessions.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fey_sessions (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  task_map   JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fey_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fey_sessions_select_own" ON public.fey_sessions
  FOR SELECT USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: 20260609_invoices.sql
-- Invoice / quote / receipt documents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoices (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app              TEXT        NOT NULL DEFAULT 'fey',
  client_id        UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  crm_contact_id   UUID,       -- set when invoice is linked to a CRM contact (FK added after crm_contacts exists)

  invoice_number   TEXT        NOT NULL DEFAULT '',
  status           TEXT        NOT NULL DEFAULT 'draft',
  issue_date       TEXT        NOT NULL DEFAULT '',
  due_date         TEXT,
  supply_date      TEXT,

  from_details     JSONB       NOT NULL DEFAULT '{}',
  bill_to          JSONB       NOT NULL DEFAULT '{}',

  line_items       JSONB       NOT NULL DEFAULT '[]',
  task_ids         JSONB       NOT NULL DEFAULT '[]',
  custom_sections  JSONB       NOT NULL DEFAULT '[]',
  payment_details  JSONB       NOT NULL DEFAULT '{}',
  totals           JSONB       NOT NULL DEFAULT '{}',
  notes            TEXT        NOT NULL DEFAULT '',
  attachments      JSONB       NOT NULL DEFAULT '[]',

  currency         TEXT        NOT NULL DEFAULT 'NGN',
  layout           TEXT        NOT NULL DEFAULT 'classic',
  font_color       TEXT        NOT NULL DEFAULT '',
  bg_color         TEXT        NOT NULL DEFAULT '',
  font_family      TEXT        NOT NULL DEFAULT '',
  invoice_settings JSONB       NOT NULL DEFAULT '{}',

  share_token      TEXT        UNIQUE,
  share_enabled    BOOLEAN     NOT NULL DEFAULT false,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_own"        ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own"        ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update_own"        ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "invoices_delete_own"        ON public.invoices FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "invoices_select_public_share" ON public.invoices FOR SELECT
  USING (share_enabled = true AND share_token IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_invoices_user_app
  ON public.invoices(user_id, app, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_share_token
  ON public.invoices(share_token)
  WHERE share_token IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: shared_clients system
-- Client workspace sharing (drives /share/<token> pages)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shared_clients (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name   TEXT        NOT NULL DEFAULT '',
  permission   TEXT        NOT NULL DEFAULT 'view',
  active       BOOLEAN     NOT NULL DEFAULT true,
  client_name  TEXT        NOT NULL DEFAULT '',
  client_color TEXT        NOT NULL DEFAULT '#D1FAE5',
  client_logo  TEXT        NOT NULL DEFAULT '',
  token        TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_clients_select_owner" ON public.shared_clients FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "shared_clients_insert_owner" ON public.shared_clients FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "shared_clients_update_owner" ON public.shared_clients FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "shared_clients_delete_owner" ON public.shared_clients FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "shared_clients_select_public" ON public.shared_clients FOR SELECT USING (active = true);

CREATE INDEX IF NOT EXISTS idx_shared_clients_owner ON public.shared_clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_clients_token ON public.shared_clients(token) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.shared_client_invites (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_client_id UUID        NOT NULL REFERENCES public.shared_clients(id) ON DELETE CASCADE,
  code             TEXT        NOT NULL UNIQUE,
  label            TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending',
  member_id        UUID,
  member_name      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_client_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_client_invites_owner" ON public.shared_client_invites FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shared_clients sc WHERE sc.id = shared_client_id AND sc.owner_id = auth.uid()));

CREATE POLICY "shared_client_invites_select_public" ON public.shared_client_invites
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_shared_client_invites_shared ON public.shared_client_invites(shared_client_id);
CREATE INDEX IF NOT EXISTS idx_shared_client_invites_code   ON public.shared_client_invites(code);

CREATE TABLE IF NOT EXISTS public.shared_client_members (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_client_id UUID        NOT NULL REFERENCES public.shared_clients(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  permission       TEXT        DEFAULT 'view',
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_client_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_client_members_owner" ON public.shared_client_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shared_clients sc WHERE sc.id = shared_client_id AND sc.owner_id = auth.uid()));

CREATE POLICY "shared_client_members_select_public" ON public.shared_client_members FOR SELECT USING (true);
CREATE POLICY "shared_client_members_insert_public" ON public.shared_client_members FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shared_client_members_shared ON public.shared_client_members(shared_client_id);

-- ── whats_new ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whats_new (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version    TEXT        NOT NULL UNIQUE,
  title      TEXT        NOT NULL,
  features   JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whats_new ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whats_new_select_public" ON public.whats_new FOR SELECT USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: 20260610_fey_settings.sql
-- Single-row-per-user typed settings table for Fey.
-- NOTE: Data migration from app_settings/user_settings is SKIPPED —
--       those are Workboard tables that don't exist on this fresh DB.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fey_settings (
  user_id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  username                  TEXT        NOT NULL DEFAULT '',
  avatar_url                TEXT        NOT NULL DEFAULT '',
  hourly_rate               TEXT        NOT NULL DEFAULT '',

  company_name              TEXT        NOT NULL DEFAULT '',
  logo                      TEXT        NOT NULL DEFAULT '',
  cover_image               TEXT        NOT NULL DEFAULT '',
  accent_color              TEXT        NOT NULL DEFAULT '#ED64A6',
  color_mode                TEXT        NOT NULL DEFAULT 'custom',
  card_size                 TEXT        NOT NULL DEFAULT 'medium',
  font_family               TEXT        NOT NULL DEFAULT '',
  custom_font               TEXT        NOT NULL DEFAULT '',
  custom_font_name          TEXT        NOT NULL DEFAULT '',
  heading_font              TEXT        NOT NULL DEFAULT '',
  custom_heading_font       TEXT        NOT NULL DEFAULT '',
  custom_heading_font_name  TEXT        NOT NULL DEFAULT '',
  invoice_layout            TEXT        NOT NULL DEFAULT 'left_aligned',
  invoice_font_color        TEXT        NOT NULL DEFAULT '#1a1a1a',
  invoice_bg_color          TEXT        NOT NULL DEFAULT '#ffffff',
  invoice_bg_image          TEXT        NOT NULL DEFAULT '',
  page_bg_type              TEXT        NOT NULL DEFAULT 'color',
  page_bg_color             TEXT        NOT NULL DEFAULT '#f9fafb',
  page_bg_image             TEXT        NOT NULL DEFAULT '',

  business_email            TEXT        NOT NULL DEFAULT '',
  business_phone            TEXT        NOT NULL DEFAULT '',
  business_website          TEXT        NOT NULL DEFAULT '',
  business_address          TEXT        NOT NULL DEFAULT '',
  tax_id                    TEXT        NOT NULL DEFAULT '',

  payment_templates         TEXT        NOT NULL DEFAULT '[]',
  show_payment_on_docs      TEXT        NOT NULL DEFAULT 'true',
  invoice_language          TEXT        NOT NULL DEFAULT 'English',
  default_tax_rate          TEXT        NOT NULL DEFAULT '',
  invoice_prefix            TEXT        NOT NULL DEFAULT 'INV-',
  invoice_next              TEXT        NOT NULL DEFAULT '001',
  quote_prefix              TEXT        NOT NULL DEFAULT 'QT-',
  quote_next                TEXT        NOT NULL DEFAULT '001',
  receipt_prefix            TEXT        NOT NULL DEFAULT 'REC-',
  receipt_next              TEXT        NOT NULL DEFAULT '001',
  include_date_in_number    TEXT        NOT NULL DEFAULT 'false',
  payment_terms_days        TEXT        NOT NULL DEFAULT '14',
  quote_valid_days          TEXT        NOT NULL DEFAULT '30',
  date_format               TEXT        NOT NULL DEFAULT 'MM/DD/YYYY',
  default_invoice_notes     TEXT        NOT NULL DEFAULT '',
  auto_generate_receipt     TEXT        NOT NULL DEFAULT 'false',
  revoke_link_on_payment    TEXT        NOT NULL DEFAULT 'false',

  currency                  TEXT        NOT NULL DEFAULT 'NGN',
  exchange_rate             TEXT        NOT NULL DEFAULT '1500',
  exchange_rates            TEXT        NOT NULL DEFAULT '{"USD":1,"NGN":1500,"GBP":0.78,"EUR":0.92}',
  exchange_rate_updated_at  TEXT        NOT NULL DEFAULT '',
  app_mode                  TEXT        NOT NULL DEFAULT 'dual',
  dashboard_heading         TEXT        NOT NULL DEFAULT E'Track your\nwork & earnings',
  dashboard_subtitle        TEXT        NOT NULL DEFAULT '',
  clients_label             TEXT        NOT NULL DEFAULT 'Clients',
  client_order              TEXT        NOT NULL DEFAULT '',

  email_acceptance          TEXT        NOT NULL DEFAULT 'true',
  email_payment_received    TEXT        NOT NULL DEFAULT 'true',
  email_stripe              TEXT        NOT NULL DEFAULT 'true',
  email_project_activity    TEXT        NOT NULL DEFAULT 'false',
  email_chat_from           TEXT        NOT NULL DEFAULT 'true',
  email_chat_to             TEXT        NOT NULL DEFAULT 'true',
  email_auto_reminders      TEXT        NOT NULL DEFAULT 'false',

  portal_subdomain          TEXT,
  portal_active             BOOLEAN     NOT NULL DEFAULT false,

  fey_sort_mode             TEXT        NOT NULL DEFAULT 'newest',
  fey_thread_order          TEXT        NOT NULL DEFAULT '',

  onboarding_complete       TEXT        NOT NULL DEFAULT 'false',
  checklist_dismissed       TEXT        NOT NULL DEFAULT 'false',
  checklist_steps           TEXT        NOT NULL DEFAULT '{}',
  guide_seen                TEXT        NOT NULL DEFAULT 'false',
  whats_new_active          TEXT        NOT NULL DEFAULT 'false',
  whats_new_version         TEXT        NOT NULL DEFAULT '',
  changelog                 TEXT        NOT NULL DEFAULT '',

  -- Workspace identity (from 20260612_workspace.sql — included here at creation time)
  workspace_slug            TEXT,
  workspace_name            TEXT        NOT NULL DEFAULT '',

  -- Fey-specific onboarding flag (from 20260612_fey_onboarding_flag.sql)
  fey_onboarding_complete   TEXT        NOT NULL DEFAULT 'false',

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fey_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fey_settings_owner_all" ON fey_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Unique workspace slug (partial — NULL rows for users not yet onboarded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fey_settings_workspace_slug
  ON fey_settings (workspace_slug)
  WHERE workspace_slug IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: 20260610140138_crm.sql (cleaned)
-- All CRM tables — portal_users, contacts, messages, files, contracts, forms.
-- CHANGED: Removed the two "ALTER TABLE user_settings" lines at the end
--          (user_settings is a Workboard table; Fey uses fey_settings).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_contacts (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   TEXT        NOT NULL,
  email                  TEXT,
  phone                  TEXT,
  company                TEXT,
  avatar_url             TEXT,
  status                 TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'idle', 'completed')),
  portal_enabled         BOOLEAN     NOT NULL DEFAULT false,
  portal_welcome_message TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id),
  sender_type TEXT        NOT NULL CHECK (sender_type IN ('owner', 'client')),
  sender_id   UUID        NOT NULL,    -- no FK: may be auth.users OR portal_users
  body        TEXT        NOT NULL,
  body_html   TEXT,
  attachments JSONB       DEFAULT '[]',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_files (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID    NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id      UUID    NOT NULL REFERENCES auth.users(id),
  uploaded_by   UUID    NOT NULL,     -- no FK: may be auth.users OR portal_users
  uploader_type TEXT    NOT NULL CHECK (uploader_type IN ('owner', 'client')),
  file_name     TEXT    NOT NULL,
  file_url      TEXT    NOT NULL,
  public_id     TEXT    NOT NULL,
  file_size     INTEGER,
  file_type     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_contracts (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID  NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id    UUID  NOT NULL REFERENCES auth.users(id),
  title       TEXT  NOT NULL,
  share_token TEXT  NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  status      TEXT  NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'signed', 'declined')),
  content     JSONB NOT NULL DEFAULT '{}',
  signed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_forms (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   UUID  NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  owner_id     UUID  NOT NULL REFERENCES auth.users(id),
  title        TEXT  NOT NULL,
  share_token  TEXT  NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  status       TEXT  NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'submitted')),
  fields       JSONB NOT NULL DEFAULT '[]',
  responses    JSONB DEFAULT '[]',
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_notifications (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID  REFERENCES crm_contacts(id) ON DELETE SET NULL,
  type       TEXT  NOT NULL,
  message    TEXT  NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_files         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contracts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_forms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_contacts"      ON crm_contacts      FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "owner_portal_users"  ON portal_users      FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "owner_messages"      ON crm_messages      FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "owner_files"         ON crm_files         FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "owner_contracts"     ON crm_contracts     FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "owner_forms"         ON crm_forms         FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "owner_notifications" ON crm_notifications FOR ALL USING (owner_id = auth.uid());

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crm_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crm_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_notifications;
  END IF;
END $$;

-- updated_at trigger
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

-- Wire up the FK from invoices to crm_contacts now that the table exists
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_crm_contact_id_fkey
  FOREIGN KEY (crm_contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL
  NOT VALID;

-- Add workspace_slug and password_hash to portal_users
-- (workspace auth columns — normally added in 20260612_workspace.sql,
--  but cleaner to have them at creation time on a fresh DB)
ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS workspace_slug TEXT,
  ADD COLUMN IF NOT EXISTS password_hash  TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_users_workspace_email
  ON portal_users (workspace_slug, email)
  WHERE workspace_slug IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9: 20260610_crm_payment_requests.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_payment_requests (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id          UUID          REFERENCES crm_contacts(id) ON DELETE SET NULL,
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency            TEXT          NOT NULL DEFAULT 'NGN',
  description         TEXT          NOT NULL DEFAULT '',
  message             TEXT          NOT NULL DEFAULT '',
  status              TEXT          NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','expired','cancelled')),
  share_token         TEXT          UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  paystack_reference  TEXT,
  paid_at             TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE crm_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_payment_requests_owner_all" ON crm_payment_requests
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "crm_payment_requests_anon_read" ON crm_payment_requests
  FOR SELECT TO anon USING (status = 'pending');

CREATE INDEX IF NOT EXISTS crm_payment_requests_owner_idx   ON crm_payment_requests (owner_id,   created_at DESC);
CREATE INDEX IF NOT EXISTS crm_payment_requests_contact_idx ON crm_payment_requests (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_payment_requests_token_idx   ON crm_payment_requests (share_token);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 10: 20260610_crm_templates.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('form', 'contract', 'invoice')),
  title      TEXT        NOT NULL,
  content    JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_templates_user_type_idx
  ON crm_templates (user_id, type, created_at DESC);

ALTER TABLE crm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_templates_owner_all" ON crm_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_crm_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_templates_updated_at
  BEFORE UPDATE ON crm_templates
  FOR EACH ROW EXECUTE FUNCTION update_crm_templates_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- DONE
-- All Fey tables are now created. Summary:
--
--   Tracker:       clients, tasks, task_groups, standalone_tasks, retainer_payments
--   Misc:          trash, whats_new
--   WhatsApp AI:   fey_threads, fey_tasks, fey_sessions, whatsapp_connections,
--                  verification_codes
--   Invoicing:     invoices
--   Client share:  shared_clients, shared_client_invites, shared_client_members
--   Settings:      fey_settings (with workspace_slug + fey_onboarding_complete)
--   CRM/Portal:    crm_contacts, portal_users (with workspace_slug + password_hash),
--                  crm_messages, crm_files, crm_contracts, crm_forms,
--                  crm_notifications, crm_payment_requests, crm_templates
-- ─────────────────────────────────────────────────────────────────────────────
