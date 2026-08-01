-- ════════════════════════════════════════════════════════════════════════════
-- Playground · Image Pipeline — reference-image control
-- Date: 2026-08-02
--
-- Additive and idempotent. Safe to re-run.
--
-- Adds a per-run choice: whether the reference images are handed to the IMAGE
-- model (Gemini) alongside the prompt, or held back so only the prompt is sent.
--
-- Why this is a run-level choice rather than a global behaviour:
-- Claude always sees the references — that is how the prompt gets written. But
-- Gemini seeing them too means anything present in the reference and absent
-- from the prompt (baked-in text, a watermark, a logo, stray background
-- furniture) can still surface in the output. Turning this off makes the
-- written prompt the single source of truth for the render.
--
-- Defaults TRUE, which is exactly the behaviour every existing run had.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE ip_generations
  ADD COLUMN IF NOT EXISTS send_reference_to_image_model BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN ip_generations.send_reference_to_image_model IS
  'When false, the render step sends the prompt only — reference images are used to WRITE the prompt but never forwarded to the image model.';
