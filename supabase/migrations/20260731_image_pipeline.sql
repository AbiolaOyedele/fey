-- ════════════════════════════════════════════════════════════════════════════
-- Playground · Image Pipeline (Batch 2, Step 1)
-- Date: 2026-07-31
--
-- One-run image generation: reference image and/or prompt → Claude writes a
-- detailed prompt → Gemini renders a 1K preview → the user approves → 2K final.
-- Credit-metered, preview-first, approve-to-finalize.
--
-- Tenancy (matches the rest of Fey, and the Batch 1 type contract): every owned
-- row carries the acting `user_id` AND the resolved workspace `owner_id`.
-- Credits and generations belong to the *user*; the workspace owner/admin — or
-- the platform super admin — administers members within that owner scope. RLS
-- reuses the SECURITY DEFINER helpers app_can_access_owner (any member) and
-- app_can_manage_owner (owner + admin).
--
-- Fey has no `profiles` table, so the spec's profiles.image_tier_override /
-- skip_prompt_review columns live on ip_user_settings instead.
--
-- updated_at is maintained by the repository layer (codebase convention).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Generations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ip_generations (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  channel                TEXT        NOT NULL DEFAULT 'api' CHECK (channel IN ('api', 'flow')),
  tier                   TEXT        NOT NULL CHECK (tier IN ('standard', 'pro')),
  status                 TEXT        NOT NULL DEFAULT 'prompting' CHECK (status IN (
                                       'prompting', 'prompt_review', 'generating_preview',
                                       'preview_ready', 'generating_final', 'complete',
                                       'rejected', 'failed', 'expired')),

  -- A run needs a reference image OR a prompt (or both) — enforced below.
  source_image_public_id TEXT        CHECK (source_image_public_id IS NULL OR char_length(source_image_public_id) <= 300),
  source_image_url       TEXT        CHECK (source_image_url IS NULL OR source_image_url ~ '^https://res\.cloudinary\.com/'),
  user_prompt            TEXT        CHECK (user_prompt IS NULL OR char_length(user_prompt) <= 4000),
  user_notes             TEXT        CHECK (user_notes IS NULL OR char_length(user_notes) <= 2000),

  generated_prompt       TEXT,
  final_prompt           TEXT,

  preview_public_id      TEXT,
  preview_url            TEXT,
  final_public_id        TEXT,
  final_url              TEXT,

  error_message          TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Retention deadline. Default 2 weeks; the caller sets 1 or 2 per the user's
  -- saved preference. The daily retention cron deletes the Cloudinary assets
  -- and marks the row 'expired' once this passes.
  expires_at             TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',

  CONSTRAINT ip_generations_needs_input
    CHECK (source_image_url IS NOT NULL OR user_prompt IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ip_generations_user    ON ip_generations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_generations_owner   ON ip_generations (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_generations_expires ON ip_generations (expires_at)
  WHERE status NOT IN ('expired', 'failed');

ALTER TABLE ip_generations ENABLE ROW LEVEL SECURITY;

-- A user sees their own runs; a workspace owner/admin sees the whole scope.
CREATE POLICY ip_generations_select ON ip_generations FOR SELECT
  USING (user_id = auth.uid() OR app_can_manage_owner(owner_id));
CREATE POLICY ip_generations_insert ON ip_generations FOR INSERT
  WITH CHECK (user_id = auth.uid() AND app_can_access_owner(owner_id));
-- Only the owning user advances their own run through the state machine.
CREATE POLICY ip_generations_update ON ip_generations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- No DELETE policy: rows are retained and marked 'expired' by the cron
-- (service role), never hard-deleted from the client.

-- ── Credit ledger ───────────────────────────────────────────────────────────
-- Immutable, append-only. Balance = SUM(delta). There is deliberately no
-- mutable balance column and no user-facing write path — every delta goes
-- through ip_charge_credits() below.

CREATE TABLE IF NOT EXISTS ip_credit_ledger (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta         NUMERIC(8,2)  NOT NULL,
  reason        TEXT          NOT NULL CHECK (reason IN (
                                'allocation', 'manual_grant', 'request_approved',
                                'preview_charge', 'final_charge', 'flow_channel', 'adjustment')),
  generation_id UUID          REFERENCES ip_generations(id) ON DELETE SET NULL,
  created_by    UUID          REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ip_credit_ledger_user  ON ip_credit_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_credit_ledger_owner ON ip_credit_ledger (owner_id, created_at DESC);

ALTER TABLE ip_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY ip_credit_ledger_select ON ip_credit_ledger FOR SELECT
  USING (user_id = auth.uid() OR app_can_manage_owner(owner_id));
-- No INSERT/UPDATE/DELETE policies by design: writes come from the
-- SECURITY DEFINER function below (or the service role, for admin grants).

-- ── Recurring allocations ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ip_credit_allocations (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        NUMERIC(8,2)  NOT NULL CHECK (amount >= 0),
  cadence       TEXT          NOT NULL CHECK (cadence IN ('weekly', 'monthly')),
  next_grant_at TIMESTAMPTZ   NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ip_credit_allocations_due ON ip_credit_allocations (next_grant_at);

ALTER TABLE ip_credit_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ip_credit_allocations_select ON ip_credit_allocations FOR SELECT
  USING (user_id = auth.uid() OR app_can_manage_owner(owner_id));
CREATE POLICY ip_credit_allocations_manage ON ip_credit_allocations FOR ALL
  USING (app_can_manage_owner(owner_id))
  WITH CHECK (app_can_manage_owner(owner_id));

-- ── Credit requests (v1 = request-only; no payments) ────────────────────────

CREATE TABLE IF NOT EXISTS ip_credit_requests (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(8,2)  NOT NULL CHECK (amount > 0 AND amount <= 1000),
  note        TEXT          CHECK (note IS NULL OR char_length(note) <= 500),
  status      TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  resolved_by UUID          REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ip_credit_requests_owner ON ip_credit_requests (owner_id, status, created_at DESC);

ALTER TABLE ip_credit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ip_credit_requests_select ON ip_credit_requests FOR SELECT
  USING (user_id = auth.uid() OR app_can_manage_owner(owner_id));
CREATE POLICY ip_credit_requests_insert ON ip_credit_requests FOR INSERT
  WITH CHECK (user_id = auth.uid() AND app_can_access_owner(owner_id));
CREATE POLICY ip_credit_requests_manage ON ip_credit_requests FOR ALL
  USING (app_can_manage_owner(owner_id))
  WITH CHECK (app_can_manage_owner(owner_id));

-- ── Per-user settings (Fey's stand-in for the spec's profiles columns) ──────

CREATE TABLE IF NOT EXISTS ip_user_settings (
  user_id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_tier_override TEXT        CHECK (image_tier_override IN ('standard', 'pro')),
  skip_prompt_review  BOOLEAN     NOT NULL DEFAULT false,
  retention_weeks     SMALLINT    NOT NULL DEFAULT 2 CHECK (retention_weeks IN (1, 2)),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ip_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ip_user_settings_select ON ip_user_settings FOR SELECT
  USING (user_id = auth.uid() OR app_can_manage_owner(owner_id));
-- A user manages their own row (retention preference); the tier override is
-- additionally gated in the service layer so only an admin can set it.
CREATE POLICY ip_user_settings_own ON ip_user_settings FOR ALL
  USING (user_id = auth.uid() AND app_can_access_owner(owner_id))
  WITH CHECK (user_id = auth.uid() AND app_can_access_owner(owner_id));
CREATE POLICY ip_user_settings_manage ON ip_user_settings FOR ALL
  USING (app_can_manage_owner(owner_id))
  WITH CHECK (app_can_manage_owner(owner_id));

-- ── Rates config (global, not owner-scoped) ─────────────────────────────────
-- Every authenticated user can read (the cost dashboard needs it); writes are
-- service-role only, gated in the API by the platform super-admin allowlist.

CREATE TABLE IF NOT EXISTS ip_rates_config (
  key        TEXT           PRIMARY KEY,
  value      NUMERIC(10,4)  NOT NULL CHECK (value >= 0),
  note       TEXT,
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

ALTER TABLE ip_rates_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY ip_rates_config_select ON ip_rates_config FOR SELECT
  USING (auth.role() = 'authenticated');

INSERT INTO ip_rates_config (key, value, note) VALUES
  ('anchor_cost_per_credit_usd', 0.6000, 'Budgeting anchor (2x buffer) — credits allocated x this = budgeted spend'),
  ('std_preview_usd',            0.0390, 'Nano Banana 1K preview'),
  ('pro_preview_usd',            0.1340, 'Nano Banana Pro 1K preview'),
  ('std_final_2k_usd',           0.0390, 'Nano Banana 2K final'),
  ('pro_final_2k_usd',           0.1340, 'Nano Banana Pro 2K final'),
  ('prompt_haiku_est_usd',       0.0050, 'Per prompt-generation call (standard tier)'),
  ('prompt_sonnet_est_usd',      0.0200, 'Per prompt-generation call (pro tier)')
ON CONFLICT (key) DO NOTHING;

-- ── Flow channel (optional desktop worker — Step 14) ────────────────────────

CREATE TABLE IF NOT EXISTS ip_flow_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID        NOT NULL REFERENCES ip_generations(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'claimed', 'running', 'done', 'failed')),
  attempts      INT         NOT NULL DEFAULT 0,
  worker_id     TEXT,
  claimed_at    TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ip_flow_jobs_queued ON ip_flow_jobs (status, created_at);

ALTER TABLE ip_flow_jobs ENABLE ROW LEVEL SECURITY;
-- Users never touch this table directly. The worker authenticates with its own
-- API key against worker-only endpoints (service role, server-side).
CREATE POLICY ip_flow_jobs_select ON ip_flow_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ip_generations g
    WHERE g.id = ip_flow_jobs.generation_id
      AND (g.user_id = auth.uid() OR app_can_manage_owner(g.owner_id))
  ));

CREATE TABLE IF NOT EXISTS ip_worker_heartbeat (
  worker_id TEXT        PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ip_worker_heartbeat ENABLE ROW LEVEL SECURITY;
-- Readable by any signed-in user: the channel selector needs to know whether a
-- desktop worker is online. Contains no sensitive data.
CREATE POLICY ip_worker_heartbeat_select ON ip_worker_heartbeat FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── The ONLY path for balance changes ───────────────────────────────────────
-- SECURITY DEFINER so it can write the ledger (which has no INSERT policy) and
-- so the balance check and the insert happen atomically.
--
-- Concurrency: SUM() cannot be locked with FOR UPDATE, so charges serialise on
-- a per-user transaction-scoped advisory lock. Two concurrent charges for the
-- same user queue; charges for different users never block each other.

CREATE OR REPLACE FUNCTION ip_charge_credits(
  p_user_id       UUID,
  p_delta         NUMERIC,
  p_reason        TEXT,
  p_generation_id UUID DEFAULT NULL,
  p_created_by    UUID DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance  NUMERIC;
  v_owner_id UUID;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'INVALID_DELTA';
  END IF;

  -- Serialise concurrent charges for this user (released at transaction end).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT COALESCE(SUM(delta), 0) INTO v_balance
    FROM ip_credit_ledger WHERE user_id = p_user_id;

  IF p_delta < 0 AND v_balance + p_delta < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  -- Owner scope follows the user's settings row, falling back to their most
  -- recent ledger entry, then to the user themselves (personal scope).
  SELECT owner_id INTO v_owner_id FROM ip_user_settings WHERE user_id = p_user_id;
  IF v_owner_id IS NULL THEN
    SELECT owner_id INTO v_owner_id FROM ip_credit_ledger
      WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  v_owner_id := COALESCE(v_owner_id, p_user_id);

  INSERT INTO ip_credit_ledger (user_id, owner_id, delta, reason, generation_id, created_by)
    VALUES (p_user_id, v_owner_id, p_delta, p_reason, p_generation_id, p_created_by);

  RETURN v_balance + p_delta;
END $$;

REVOKE ALL ON FUNCTION ip_charge_credits(UUID, NUMERIC, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ip_charge_credits(UUID, NUMERIC, TEXT, UUID, UUID) TO authenticated, service_role;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- The Generate page subscribes to its own run so prompt/preview/final
-- transitions appear without polling. Guarded so re-running is safe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ip_generations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ip_generations;
  END IF;
END $$;
