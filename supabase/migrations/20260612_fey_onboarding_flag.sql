-- Add a Fey-specific onboarding completion flag.
-- This is separate from onboarding_complete, which is used by Workboard.
-- Both apps share this Supabase project — using separate columns prevents clashes.

ALTER TABLE fey_settings
  ADD COLUMN IF NOT EXISTS fey_onboarding_complete TEXT NOT NULL DEFAULT 'false';
