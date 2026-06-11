-- fey_settings: a single-row-per-user, typed settings table for the Fey app.
-- Replaces the shared app_settings key-value store to avoid clashes with other
-- projects that share the same Supabase project.
--
-- All text-based settings match the Settings interface in src/types/index.ts so
-- the SettingsContext can SELECT * and map columns directly.

CREATE TABLE IF NOT EXISTS fey_settings (
  user_id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile
  username                  TEXT NOT NULL DEFAULT '',
  avatar_url                TEXT NOT NULL DEFAULT '',
  hourly_rate               TEXT NOT NULL DEFAULT '',

  -- Brand / Visual
  company_name              TEXT NOT NULL DEFAULT '',
  logo                      TEXT NOT NULL DEFAULT '',
  cover_image               TEXT NOT NULL DEFAULT '',
  accent_color              TEXT NOT NULL DEFAULT '#ED64A6',
  color_mode                TEXT NOT NULL DEFAULT 'custom',
  card_size                 TEXT NOT NULL DEFAULT 'medium',
  font_family               TEXT NOT NULL DEFAULT '',
  custom_font               TEXT NOT NULL DEFAULT '',
  custom_font_name          TEXT NOT NULL DEFAULT '',
  heading_font              TEXT NOT NULL DEFAULT '',
  custom_heading_font       TEXT NOT NULL DEFAULT '',
  custom_heading_font_name  TEXT NOT NULL DEFAULT '',
  invoice_layout            TEXT NOT NULL DEFAULT 'left_aligned',
  invoice_font_color        TEXT NOT NULL DEFAULT '#1a1a1a',
  invoice_bg_color          TEXT NOT NULL DEFAULT '#ffffff',
  invoice_bg_image          TEXT NOT NULL DEFAULT '',
  page_bg_type              TEXT NOT NULL DEFAULT 'color',
  page_bg_color             TEXT NOT NULL DEFAULT '#f9fafb',
  page_bg_image             TEXT NOT NULL DEFAULT '',

  -- Business Details
  business_email            TEXT NOT NULL DEFAULT '',
  business_phone            TEXT NOT NULL DEFAULT '',
  business_website          TEXT NOT NULL DEFAULT '',
  business_address          TEXT NOT NULL DEFAULT '',
  tax_id                    TEXT NOT NULL DEFAULT '',

  -- Invoice / Document Settings
  payment_templates         TEXT NOT NULL DEFAULT '[]',
  show_payment_on_docs      TEXT NOT NULL DEFAULT 'true',
  invoice_language          TEXT NOT NULL DEFAULT 'English',
  default_tax_rate          TEXT NOT NULL DEFAULT '',
  invoice_prefix            TEXT NOT NULL DEFAULT 'INV-',
  invoice_next              TEXT NOT NULL DEFAULT '001',
  quote_prefix              TEXT NOT NULL DEFAULT 'QT-',
  quote_next                TEXT NOT NULL DEFAULT '001',
  receipt_prefix            TEXT NOT NULL DEFAULT 'REC-',
  receipt_next              TEXT NOT NULL DEFAULT '001',
  include_date_in_number    TEXT NOT NULL DEFAULT 'false',
  payment_terms_days        TEXT NOT NULL DEFAULT '14',
  quote_valid_days          TEXT NOT NULL DEFAULT '30',
  date_format               TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
  default_invoice_notes     TEXT NOT NULL DEFAULT '',
  auto_generate_receipt     TEXT NOT NULL DEFAULT 'false',
  revoke_link_on_payment    TEXT NOT NULL DEFAULT 'false',

  -- App / General
  currency                  TEXT NOT NULL DEFAULT 'NGN',
  exchange_rate             TEXT NOT NULL DEFAULT '1500',
  exchange_rates            TEXT NOT NULL DEFAULT '{"USD":1,"NGN":1500,"GBP":0.78,"EUR":0.92}',
  exchange_rate_updated_at  TEXT NOT NULL DEFAULT '',
  app_mode                  TEXT NOT NULL DEFAULT 'dual',
  dashboard_heading         TEXT NOT NULL DEFAULT 'Track your\nwork & earnings',
  dashboard_subtitle        TEXT NOT NULL DEFAULT '',
  clients_label             TEXT NOT NULL DEFAULT 'Clients',
  client_order              TEXT NOT NULL DEFAULT '',

  -- Notifications / Email Preferences
  email_acceptance          TEXT NOT NULL DEFAULT 'true',
  email_payment_received    TEXT NOT NULL DEFAULT 'true',
  email_stripe              TEXT NOT NULL DEFAULT 'true',
  email_project_activity    TEXT NOT NULL DEFAULT 'false',
  email_chat_from           TEXT NOT NULL DEFAULT 'true',
  email_chat_to             TEXT NOT NULL DEFAULT 'true',
  email_auto_reminders      TEXT NOT NULL DEFAULT 'false',

  -- Portal (stored here instead of user_settings to keep Fey isolated)
  portal_subdomain          TEXT,
  portal_active             BOOLEAN NOT NULL DEFAULT false,

  -- Fey AI (managed by the Fey AI page, not the settings UI)
  fey_sort_mode             TEXT NOT NULL DEFAULT 'newest',
  fey_thread_order          TEXT NOT NULL DEFAULT '',

  -- Internal / Onboarding flags (not shown in settings UI)
  onboarding_complete       TEXT NOT NULL DEFAULT 'false',
  checklist_dismissed       TEXT NOT NULL DEFAULT 'false',
  checklist_steps           TEXT NOT NULL DEFAULT '{}',
  guide_seen                TEXT NOT NULL DEFAULT 'false',
  whats_new_active          TEXT NOT NULL DEFAULT 'false',
  whats_new_version         TEXT NOT NULL DEFAULT '',
  changelog                 TEXT NOT NULL DEFAULT '',

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fey_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fey_settings_owner_all" ON fey_settings
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Migrate existing data from app_settings ───────────────────────────────────
-- Uses a PIVOT (conditional aggregation) to convert key-value rows → columns.
-- ON CONFLICT (user_id) DO NOTHING so re-running is safe.

INSERT INTO fey_settings (
  user_id, username, avatar_url, hourly_rate,
  company_name, logo, cover_image,
  accent_color, color_mode, card_size,
  font_family, custom_font, custom_font_name,
  heading_font, custom_heading_font, custom_heading_font_name,
  invoice_layout, invoice_font_color, invoice_bg_color, invoice_bg_image,
  page_bg_type, page_bg_color, page_bg_image,
  business_email, business_phone, business_website, business_address, tax_id,
  payment_templates, show_payment_on_docs,
  invoice_language, default_tax_rate,
  invoice_prefix, invoice_next, quote_prefix, quote_next, receipt_prefix, receipt_next,
  include_date_in_number, payment_terms_days, quote_valid_days,
  date_format, default_invoice_notes, auto_generate_receipt, revoke_link_on_payment,
  currency, exchange_rate, exchange_rates, exchange_rate_updated_at,
  app_mode, dashboard_heading, dashboard_subtitle, clients_label, client_order,
  email_acceptance, email_payment_received, email_stripe, email_project_activity,
  email_chat_from, email_chat_to, email_auto_reminders,
  fey_sort_mode, fey_thread_order,
  onboarding_complete, checklist_dismissed, checklist_steps, guide_seen,
  whats_new_active, whats_new_version, changelog
)
SELECT
  user_id,
  COALESCE(MAX(CASE WHEN key = 'username'                  THEN value END), '')            AS username,
  COALESCE(MAX(CASE WHEN key = 'avatar_url'                THEN value END), '')            AS avatar_url,
  COALESCE(MAX(CASE WHEN key = 'hourly_rate'               THEN value END), '')            AS hourly_rate,
  COALESCE(MAX(CASE WHEN key = 'company_name'              THEN value END), '')            AS company_name,
  COALESCE(MAX(CASE WHEN key = 'logo'                      THEN value END), '')            AS logo,
  COALESCE(MAX(CASE WHEN key = 'cover_image'               THEN value END), '')            AS cover_image,
  COALESCE(MAX(CASE WHEN key = 'accent_color'              THEN value END), '#ED64A6')     AS accent_color,
  COALESCE(MAX(CASE WHEN key = 'color_mode'                THEN value END), 'custom')      AS color_mode,
  COALESCE(MAX(CASE WHEN key = 'card_size'                 THEN value END), 'medium')      AS card_size,
  COALESCE(MAX(CASE WHEN key = 'font_family'               THEN value END), '')            AS font_family,
  COALESCE(MAX(CASE WHEN key = 'custom_font'               THEN value END), '')            AS custom_font,
  COALESCE(MAX(CASE WHEN key = 'custom_font_name'          THEN value END), '')            AS custom_font_name,
  COALESCE(MAX(CASE WHEN key = 'heading_font'              THEN value END), '')            AS heading_font,
  COALESCE(MAX(CASE WHEN key = 'custom_heading_font'       THEN value END), '')            AS custom_heading_font,
  COALESCE(MAX(CASE WHEN key = 'custom_heading_font_name'  THEN value END), '')            AS custom_heading_font_name,
  COALESCE(MAX(CASE WHEN key = 'invoice_layout'            THEN value END), 'left_aligned') AS invoice_layout,
  COALESCE(MAX(CASE WHEN key = 'invoice_font_color'        THEN value END), '#1a1a1a')     AS invoice_font_color,
  COALESCE(MAX(CASE WHEN key = 'invoice_bg_color'          THEN value END), '#ffffff')     AS invoice_bg_color,
  COALESCE(MAX(CASE WHEN key = 'invoice_bg_image'          THEN value END), '')            AS invoice_bg_image,
  COALESCE(MAX(CASE WHEN key = 'page_bg_type'              THEN value END), 'color')       AS page_bg_type,
  COALESCE(MAX(CASE WHEN key = 'page_bg_color'             THEN value END), '#f9fafb')     AS page_bg_color,
  COALESCE(MAX(CASE WHEN key = 'page_bg_image'             THEN value END), '')            AS page_bg_image,
  COALESCE(MAX(CASE WHEN key = 'business_email'            THEN value END), '')            AS business_email,
  COALESCE(MAX(CASE WHEN key = 'business_phone'            THEN value END), '')            AS business_phone,
  COALESCE(MAX(CASE WHEN key = 'business_website'          THEN value END), '')            AS business_website,
  COALESCE(MAX(CASE WHEN key = 'business_address'          THEN value END), '')            AS business_address,
  COALESCE(MAX(CASE WHEN key = 'tax_id'                    THEN value END), '')            AS tax_id,
  COALESCE(MAX(CASE WHEN key = 'payment_templates'         THEN value END), '[]')          AS payment_templates,
  COALESCE(MAX(CASE WHEN key = 'show_payment_on_docs'      THEN value END), 'true')        AS show_payment_on_docs,
  COALESCE(MAX(CASE WHEN key = 'invoice_language'          THEN value END), 'English')     AS invoice_language,
  COALESCE(MAX(CASE WHEN key = 'default_tax_rate'          THEN value END), '')            AS default_tax_rate,
  COALESCE(MAX(CASE WHEN key = 'invoice_prefix'            THEN value END), 'INV-')        AS invoice_prefix,
  COALESCE(MAX(CASE WHEN key = 'invoice_next'              THEN value END), '001')         AS invoice_next,
  COALESCE(MAX(CASE WHEN key = 'quote_prefix'              THEN value END), 'QT-')         AS quote_prefix,
  COALESCE(MAX(CASE WHEN key = 'quote_next'                THEN value END), '001')         AS quote_next,
  COALESCE(MAX(CASE WHEN key = 'receipt_prefix'            THEN value END), 'REC-')        AS receipt_prefix,
  COALESCE(MAX(CASE WHEN key = 'receipt_next'              THEN value END), '001')         AS receipt_next,
  COALESCE(MAX(CASE WHEN key = 'include_date_in_number'    THEN value END), 'false')       AS include_date_in_number,
  COALESCE(MAX(CASE WHEN key = 'payment_terms_days'        THEN value END), '14')          AS payment_terms_days,
  COALESCE(MAX(CASE WHEN key = 'quote_valid_days'          THEN value END), '30')          AS quote_valid_days,
  COALESCE(MAX(CASE WHEN key = 'date_format'               THEN value END), 'MM/DD/YYYY')  AS date_format,
  COALESCE(MAX(CASE WHEN key = 'default_invoice_notes'     THEN value END), '')            AS default_invoice_notes,
  COALESCE(MAX(CASE WHEN key = 'auto_generate_receipt'     THEN value END), 'false')       AS auto_generate_receipt,
  COALESCE(MAX(CASE WHEN key = 'revoke_link_on_payment'    THEN value END), 'false')       AS revoke_link_on_payment,
  COALESCE(MAX(CASE WHEN key = 'currency'                  THEN value END), 'NGN')         AS currency,
  COALESCE(MAX(CASE WHEN key = 'exchange_rate'             THEN value END), '1500')        AS exchange_rate,
  COALESCE(MAX(CASE WHEN key = 'exchange_rates'            THEN value END), '{"USD":1,"NGN":1500,"GBP":0.78,"EUR":0.92}') AS exchange_rates,
  COALESCE(MAX(CASE WHEN key = 'exchange_rate_updated_at'  THEN value END), '')            AS exchange_rate_updated_at,
  COALESCE(MAX(CASE WHEN key = 'app_mode'                  THEN value END), 'dual')        AS app_mode,
  COALESCE(MAX(CASE WHEN key = 'dashboard_heading'         THEN value END), E'Track your\nwork & earnings') AS dashboard_heading,
  COALESCE(MAX(CASE WHEN key = 'dashboard_subtitle'        THEN value END), '')            AS dashboard_subtitle,
  COALESCE(MAX(CASE WHEN key = 'clients_label'             THEN value END), 'Clients')     AS clients_label,
  COALESCE(MAX(CASE WHEN key = 'client_order'              THEN value END), '')            AS client_order,
  COALESCE(MAX(CASE WHEN key = 'email_acceptance'          THEN value END), 'true')        AS email_acceptance,
  COALESCE(MAX(CASE WHEN key = 'email_payment_received'    THEN value END), 'true')        AS email_payment_received,
  COALESCE(MAX(CASE WHEN key = 'email_stripe'              THEN value END), 'true')        AS email_stripe,
  COALESCE(MAX(CASE WHEN key = 'email_project_activity'    THEN value END), 'false')       AS email_project_activity,
  COALESCE(MAX(CASE WHEN key = 'email_chat_from'           THEN value END), 'true')        AS email_chat_from,
  COALESCE(MAX(CASE WHEN key = 'email_chat_to'             THEN value END), 'true')        AS email_chat_to,
  COALESCE(MAX(CASE WHEN key = 'email_auto_reminders'      THEN value END), 'false')       AS email_auto_reminders,
  COALESCE(MAX(CASE WHEN key = 'fey_sort_mode'             THEN value END), 'newest')      AS fey_sort_mode,
  COALESCE(MAX(CASE WHEN key = 'fey_thread_order'          THEN value END), '')            AS fey_thread_order,
  COALESCE(MAX(CASE WHEN key = 'onboarding_complete'       THEN value END), 'false')       AS onboarding_complete,
  COALESCE(MAX(CASE WHEN key = 'checklist_dismissed'       THEN value END), 'false')       AS checklist_dismissed,
  COALESCE(MAX(CASE WHEN key = 'checklist_steps'           THEN value END), '{}')          AS checklist_steps,
  COALESCE(MAX(CASE WHEN key = 'guide_seen'                THEN value END), 'false')       AS guide_seen,
  COALESCE(MAX(CASE WHEN key = 'whats_new_active'          THEN value END), 'false')       AS whats_new_active,
  COALESCE(MAX(CASE WHEN key = 'whats_new_version'         THEN value END), '')            AS whats_new_version,
  COALESCE(MAX(CASE WHEN key = 'changelog'                 THEN value END), '')            AS changelog
FROM app_settings
WHERE app = 'fey'
GROUP BY user_id
ON CONFLICT (user_id) DO NOTHING;

-- Also pull portal settings that were stored in user_settings
UPDATE fey_settings fs
SET
  portal_subdomain = us.portal_subdomain,
  portal_active    = COALESCE(us.portal_active, false)
FROM user_settings us
WHERE us.user_id = fs.user_id
  AND us.app = 'fey'
  AND us.portal_subdomain IS NOT NULL;
