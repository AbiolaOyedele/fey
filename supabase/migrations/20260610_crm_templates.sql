-- crm_templates: stores reusable form/contract/invoice templates per user
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS crm_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('form', 'contract', 'invoice')),
  title      TEXT        NOT NULL,
  content    JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-user, per-type lookups
CREATE INDEX IF NOT EXISTS crm_templates_user_type_idx
  ON crm_templates (user_id, type, created_at DESC);

-- Row-level security — users can only access their own templates
ALTER TABLE crm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_templates_owner_all"
  ON crm_templates
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on every row change
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
