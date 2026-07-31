-- ════════════════════════════════════════════════════════════════════════════
-- Playground · Image Pipeline — enhancements
-- Date: 2026-08-01
--
-- Additive, idempotent follow-up to 20260731_image_pipeline.sql. Safe to run
-- whether or not any data exists yet, and it never edits the base migration.
--
-- Adds:
--   1. Multiple reference images per run (arrays), replacing the single-image
--      columns. The old single columns are kept (unused) so the change is
--      non-destructive; a new "needs input" constraint counts the array.
--   2. Realtime on the credit ledger and credit requests, so a granted/approved
--      credit reflects in the header and Credits page with no manual refresh,
--      and a new request appears in the admin queue live.
--
-- The prompt-preset feature ships in a later migration once the preset list is
-- finalised.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Multiple reference images ────────────────────────────────────────────
-- A run may carry up to 4 reference images. Per-element URL validation is done
-- server-side in the Zod schema (a CHECK can't easily validate array elements);
-- here we only cap the count.

ALTER TABLE ip_generations
  ADD COLUMN IF NOT EXISTS source_image_urls       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_image_public_ids TEXT[] NOT NULL DEFAULT '{}';

-- Carry any single-image rows created before this migration into the arrays.
UPDATE ip_generations
  SET source_image_urls = ARRAY[source_image_url]
  WHERE source_image_url IS NOT NULL
    AND (source_image_urls IS NULL OR cardinality(source_image_urls) = 0);
UPDATE ip_generations
  SET source_image_public_ids = ARRAY[source_image_public_id]
  WHERE source_image_public_id IS NOT NULL
    AND (source_image_public_ids IS NULL OR cardinality(source_image_public_ids) = 0);

-- Cap the number of reference images.
ALTER TABLE ip_generations DROP CONSTRAINT IF EXISTS ip_generations_max_images;
ALTER TABLE ip_generations
  ADD CONSTRAINT ip_generations_max_images
  CHECK (cardinality(source_image_urls) <= 4 AND cardinality(source_image_public_ids) <= 4);

-- A run still needs at least one reference image OR a prompt — now counting the
-- array instead of the single column.
ALTER TABLE ip_generations DROP CONSTRAINT IF EXISTS ip_generations_needs_input;
ALTER TABLE ip_generations
  ADD CONSTRAINT ip_generations_needs_input
  CHECK (cardinality(source_image_urls) > 0 OR user_prompt IS NOT NULL);

-- ── 2. Realtime for credits ─────────────────────────────────────────────────
-- The base migration publishes ip_generations. Publish the ledger (balance +
-- history) and requests (admin queue) too, so grants/approvals/new requests
-- land live. Guarded so re-running is safe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ip_credit_ledger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ip_credit_ledger;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ip_credit_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ip_credit_requests;
  END IF;
END $$;

-- ── 3. Prompt presets ───────────────────────────────────────────────────────
-- The prompt-writing step runs under a chosen "preset" system prompt. Built-in
-- presets live in code (server-only text, cached at the model). Workspaces can
-- also author their OWN presets, stored here and scoped to the owner. Each run
-- records which preset key it used (a built-in key like 'default', or a custom
-- preset's UUID). App-validated; a loose length check only.

ALTER TABLE ip_generations
  ADD COLUMN IF NOT EXISTS prompt_preset TEXT NOT NULL DEFAULT 'default';

ALTER TABLE ip_generations DROP CONSTRAINT IF EXISTS ip_generations_prompt_preset_len;
ALTER TABLE ip_generations
  ADD CONSTRAINT ip_generations_prompt_preset_len
  CHECK (char_length(prompt_preset) BETWEEN 1 AND 64);

CREATE TABLE IF NOT EXISTS ip_prompt_presets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The member who created it (for "manage your own" rights).
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description   TEXT        CHECK (description IS NULL OR char_length(description) <= 200),
  system_prompt TEXT        NOT NULL CHECK (char_length(system_prompt) BETWEEN 1 AND 8000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ip_prompt_presets_owner ON ip_prompt_presets (owner_id, created_at DESC);

ALTER TABLE ip_prompt_presets ENABLE ROW LEVEL SECURITY;

-- Any member of the scope can read + use the workspace's presets.
DROP POLICY IF EXISTS ip_prompt_presets_select ON ip_prompt_presets;
CREATE POLICY ip_prompt_presets_select ON ip_prompt_presets FOR SELECT
  USING (app_can_access_owner(owner_id));
-- A member creates presets under their own id within a scope they belong to.
DROP POLICY IF EXISTS ip_prompt_presets_insert ON ip_prompt_presets;
CREATE POLICY ip_prompt_presets_insert ON ip_prompt_presets FOR INSERT
  WITH CHECK (user_id = auth.uid() AND app_can_access_owner(owner_id));
-- The creator, or a workspace owner/admin, may edit/delete.
DROP POLICY IF EXISTS ip_prompt_presets_update ON ip_prompt_presets;
CREATE POLICY ip_prompt_presets_update ON ip_prompt_presets FOR UPDATE
  USING (user_id = auth.uid() OR app_can_manage_owner(owner_id))
  WITH CHECK (user_id = auth.uid() OR app_can_manage_owner(owner_id));
DROP POLICY IF EXISTS ip_prompt_presets_delete ON ip_prompt_presets;
CREATE POLICY ip_prompt_presets_delete ON ip_prompt_presets FOR DELETE
  USING (user_id = auth.uid() OR app_can_manage_owner(owner_id));
