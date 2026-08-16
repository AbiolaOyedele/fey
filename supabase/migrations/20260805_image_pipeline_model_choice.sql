-- ════════════════════════════════════════════════════════════════════════════
-- Playground · Image Pipeline — choosable image model
-- Date: 2026-08-05
--
-- Additive and idempotent. Safe to re-run.
--
-- Until now the render engine was implied by the tier: standard meant
-- gemini-2.5-flash-image, pro meant gemini-3-pro-image, and there was no way to
-- ask for anything else. This makes the engine an explicit, per-run choice
-- across two providers (OpenAI and Google), with a saved per-user default.
--
-- Two columns:
--   • ip_generations.image_model      — the engine a run actually used.
--   • ip_user_settings.default_image_model — the engine to pre-select next time.
--
-- Both are deliberately left NULL-able rather than back-filled:
--   NULL on a generation means "started before this existed", and the service
--   resolves it to the Gemini model that run's tier would have used. A retry of
--   an old run therefore renders on the same engine that produced it, instead of
--   silently switching provider halfway through a run the user already paid for.
--   NULL on settings means "no saved preference" and falls back to the app
--   default (currently OpenAI's gpt-image-1).
--
-- No CHECK constraint on the values: the catalogue of models lives in
-- src/types/image-pipeline.ts and is validated there on the way in. Pinning the
-- list in Postgres too would mean a migration every time a provider ships a
-- model, and would reject rows the application layer has already accepted.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE ip_generations
  ADD COLUMN IF NOT EXISTS image_model TEXT
    CHECK (image_model IS NULL OR char_length(image_model) <= 64);

COMMENT ON COLUMN ip_generations.image_model IS
  'Image model that rendered this run (e.g. gpt-image-1, gemini-3-pro-image). NULL = pre-dates model choice; resolved to the tier''s Gemini model so retries stay on the original engine.';

ALTER TABLE ip_user_settings
  ADD COLUMN IF NOT EXISTS default_image_model TEXT
    CHECK (default_image_model IS NULL OR char_length(default_image_model) <= 64);

COMMENT ON COLUMN ip_user_settings.default_image_model IS
  'The user''s preferred image model, pre-selected on the Generate page. NULL = use the app default.';
