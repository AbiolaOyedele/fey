/**
 * Image Pipeline — shared type contract.
 *
 * This is the single source of truth for the Image Pipeline module (Batch 1,
 * Step 1). Mock repositories, real repositories, services, API routes and
 * components all import from here. Swapping a mock repository for its real
 * implementation must be an import change only — both sides satisfy the same
 * interfaces defined at the bottom of this file.
 *
 * Conventions (to match the rest of Fey):
 *   • Row/entity + API-payload fields use snake_case, mirroring the DB columns
 *     (same as Ruff watermarks and the Social corner).
 *   • Nullable DB columns are modelled as `T | null`. Genuinely-optional request
 *     fields use `?` (never `| undefined`, for exactOptionalPropertyTypes).
 *   • Tenancy is per-user, workspace-aware: every owned row carries both the
 *     acting `user_id` and the resolved `owner_id` (via resolveOwnerContext).
 *     Credits/generations belong to the user; a workspace owner/admin — or the
 *     platform admin (ADMIN_EMAILS) — can administer members within that owner
 *     scope.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Enums / string unions
 * Exported as `as const` tuples so services + Zod schemas share one source of
 * truth instead of re-declaring the literals.
 * ──────────────────────────────────────────────────────────────────────────── */

export const IMAGE_TIERS = ['standard', 'pro'] as const
export type ImageTier = (typeof IMAGE_TIERS)[number]

export const GENERATION_CHANNELS = ['api', 'flow'] as const
export type GenerationChannel = (typeof GENERATION_CHANNELS)[number]

export const GENERATION_STATUSES = [
  'prompting',
  'prompt_review',
  'generating_preview',
  'preview_ready',
  'generating_final',
  'complete',
  'rejected',
  'failed',
  'expired',
] as const
export type GenerationStatus = (typeof GENERATION_STATUSES)[number]

/** Statuses that count against the "max 3 in-flight generations" abuse guard. */
export const IN_FLIGHT_STATUSES: readonly GenerationStatus[] = [
  'prompting',
  'prompt_review',
  'generating_preview',
  'preview_ready',
  'generating_final',
] as const

export const LEDGER_REASONS = [
  'allocation',
  'manual_grant',
  'request_approved',
  'preview_charge',
  'final_charge',
  'flow_channel',
  'adjustment',
] as const
export type LedgerReason = (typeof LEDGER_REASONS)[number]

export const ALLOCATION_CADENCES = ['weekly', 'monthly'] as const
export type AllocationCadence = (typeof ALLOCATION_CADENCES)[number]

export const CREDIT_REQUEST_STATUSES = ['pending', 'approved', 'denied'] as const
export type CreditRequestStatus = (typeof CREDIT_REQUEST_STATUSES)[number]

export const FLOW_JOB_STATUSES = ['queued', 'claimed', 'running', 'done', 'failed'] as const
export type FlowJobStatus = (typeof FLOW_JOB_STATUSES)[number]

/** Rates-config keys seeded in the migration. Keeps the cost dashboard typed. */
export const RATE_KEYS = [
  'anchor_cost_per_credit_usd',
  'std_preview_usd',
  'pro_preview_usd',
  'pro_final_2k_usd',
  'std_final_2k_usd',
  'prompt_haiku_est_usd',
  'prompt_sonnet_est_usd',
] as const
export type RateKey = (typeof RATE_KEYS)[number]

/* ────────────────────────────────────────────────────────────────────────────
 * Credit charge amounts (product-defined, not user-supplied).
 * Every charge is applied server-side through the ip_charge_credits SECURITY
 * DEFINER function — these constants only describe how much each step costs.
 * ──────────────────────────────────────────────────────────────────────────── */

export const CREDIT_COST = {
  /** Starting a generation / each additional preview after a prompt edit. */
  preview: 0.25,
  /** Approving a preview to render the 2K final. */
  final: 0.75,
} as const

/** One full pipeline run = preview + final. */
export const CREDITS_PER_RUN = CREDIT_COST.preview + CREDIT_COST.final // 1.0

/** Max simultaneous non-finalized generations per user. */
export const MAX_IN_FLIGHT_PER_USER = 3

/** Max generation starts per user per minute (rate limit). */
export const MAX_GENERATION_STARTS_PER_MINUTE = 10

/** Retention: how long generated images are kept before auto-deletion. */
export const RETENTION_WEEK_OPTIONS = [1, 2] as const
export type RetentionWeeks = (typeof RETENTION_WEEK_OPTIONS)[number]
export const DEFAULT_RETENTION_WEEKS: RetentionWeeks = 2

/** Max reference images a single run may carry (both Claude and Gemini accept several). */
export const MAX_REFERENCE_IMAGES = 4

/* ────────────────────────────────────────────────────────────────────────────
 * Prompt presets
 * The prompt-writing step runs under a chosen "preset" system prompt. Built-in
 * presets are defined in code (their system-prompt text is server-only and is
 * cached at the model). Workspaces can also author their own presets, stored in
 * ip_prompt_presets. A generation records the preset KEY it used: a built-in key
 * (e.g. 'default') or a custom preset's UUID.
 * ──────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_PROMPT_PRESET_KEY = 'default'

/** Field limits shared by the DB, Zod schemas and the UI. */
export const PRESET_LIMITS = {
  name: 80,
  description: 200,
  systemPrompt: 8000,
} as const

/** Built-in preset metadata (label/description only — the system prompt is server-only). */
export interface BuiltinPresetMeta {
  key: string
  label: string
  description: string
}

/**
 * Built-in presets, always available to every workspace. Keep the KEY stable
 * (it's stored on generations); the system-prompt text for each lives in
 * `src/lib/image-pipeline-presets.ts` (server-only).
 */
export const BUILTIN_PROMPT_PRESETS: readonly BuiltinPresetMeta[] = [
  {
    key: DEFAULT_PROMPT_PRESET_KEY,
    label: 'Default — cinematic realism',
    description: 'Richly detailed, photorealistic prompts with camera, lighting and film-grain cues.',
  },
] as const

/** A workspace-authored preset. Maps to ip_prompt_presets. */
export interface IpPromptPreset {
  id: string
  owner_id: string
  /** The member who created it (drives "manage your own" rights). */
  user_id: string
  name: string
  description: string | null
  system_prompt: string
  created_at: string
  updated_at: string
}

/**
 * A selectable preset in the UI — a built-in or a custom one, in one shape.
 * `key` is what gets stored on the generation and sent when starting a run.
 */
export interface PromptPresetOption {
  key: string
  label: string
  description: string | null
  builtin: boolean
  /** Custom presets only — the user-authored text, shown in the manage UI. */
  system_prompt?: string
  /** Custom presets only — creator id, so the UI can gate edit/delete. */
  created_by?: string
}

/** POST/PATCH body for creating or updating a custom preset. */
export interface UpsertPromptPresetRequest {
  name: string
  description?: string
  system_prompt: string
}

/** GET /api/v1/image-pipeline/presets — built-ins first, then the workspace's own. */
export interface ListPromptPresetsResponse {
  presets: PromptPresetOption[]
}

/* ────────────────────────────────────────────────────────────────────────────
 * Entity rows (mirror DB tables)
 * ──────────────────────────────────────────────────────────────────────────── */

/** A single pipeline run. Maps to `ip_generations`. */
export interface IpGeneration {
  id: string
  /** The user who owns this generation and is charged for it. */
  user_id: string
  /** Resolved workspace owner scope (equals user_id in the personal case). */
  owner_id: string
  channel: GenerationChannel
  tier: ImageTier
  status: GenerationStatus
  /**
   * Reference images are optional — a run can be prompt-only. Up to
   * MAX_REFERENCE_IMAGES; empty arrays mean no reference. Index-aligned:
   * source_image_urls[i] is the Cloudinary URL for source_image_public_ids[i].
   */
  source_image_public_ids: string[]
  source_image_urls: string[]
  /** The user's own prompt when they supply one (Claude then improves it). */
  user_prompt: string | null
  user_notes: string | null
  /** Which preset drove the prompt step: a built-in key or a custom preset UUID. */
  prompt_preset: string
  /** Prompt returned by the prompt model; editable at the prompt gate. */
  generated_prompt: string | null
  /** Prompt actually used to render images (after any user edit). */
  final_prompt: string | null
  preview_public_id: string | null
  preview_url: string | null
  final_public_id: string | null
  final_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  /** 7-day retention deadline. */
  expires_at: string
}

/** One immutable ledger row. Maps to `ip_credit_ledger`. Balance = SUM(delta). */
export interface IpCreditLedgerEntry {
  id: string
  user_id: string
  owner_id: string
  /** Positive = grant, negative = charge. NUMERIC(8,2) in the DB. */
  delta: number
  reason: LedgerReason
  /** Set for preview_charge / final_charge / flow_channel. */
  generation_id: string | null
  /** Admin who created a manual grant / adjustment, if any. */
  created_by: string | null
  created_at: string
}

/** A recurring credit allocation. Maps to `ip_credit_allocations`. */
export interface IpCreditAllocation {
  id: string
  user_id: string
  owner_id: string
  amount: number
  cadence: AllocationCadence
  next_grant_at: string
  created_at: string
  updated_at: string
}

/** A user's request for more credits. Maps to `ip_credit_requests`. */
export interface IpCreditRequest {
  id: string
  user_id: string
  owner_id: string
  amount: number
  note: string | null
  status: CreditRequestStatus
  resolved_by: string | null
  created_at: string
  updated_at: string
}

/** A single editable pricing row. Maps to `ip_rates_config`. */
export interface IpRateConfig {
  key: RateKey
  value: number
  note: string | null
  updated_at: string
}

/**
 * Per-user Image Pipeline settings. Maps to `ip_user_settings` — Fey's stand-in
 * for the spec's `profiles.image_tier_override` / `profiles.skip_prompt_review`
 * columns, since Fey has no profiles table.
 */
export interface IpUserSettings {
  user_id: string
  owner_id: string
  /** Explicit tier override set by an admin; null = derive by role. */
  image_tier_override: ImageTier | null
  /** When true, the prompt gate is skipped (prompt still shown + editable). */
  skip_prompt_review: boolean
  /** How many weeks generated images are kept before auto-deletion (1 or 2). */
  retention_weeks: RetentionWeeks
  updated_at: string
}

/** A queued Flow-channel job. Maps to `ip_flow_jobs`. */
export interface IpFlowJob {
  id: string
  generation_id: string
  status: FlowJobStatus
  attempts: number
  claimed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

/** Worker liveness row. Maps to `ip_worker_heartbeat`. */
export interface IpWorkerHeartbeat {
  worker_id: string
  last_seen: string
}

/* ────────────────────────────────────────────────────────────────────────────
 * Derived / computed shapes
 * ──────────────────────────────────────────────────────────────────────────── */

/** A user's current credit position, derived from the ledger. */
export interface CreditBalance {
  /** SUM(delta) across the user's ledger. */
  balance: number
  /** How much a full run costs, surfaced for the UI's "can I afford this?". */
  cost_per_run: number
}

/** Result of server-side tier resolution (client never sends tier). */
export interface TierResolution {
  tier: ImageTier
  /** Why this tier was chosen — for admin visibility / debugging. */
  source: 'override' | 'admin_default' | 'standard_default'
}

/** Rates as a keyed map, for the cost dashboard math. */
export type RatesMap = Record<RateKey, number>

/**
 * The admin capabilities of the current requester, resolved server-side.
 * Frontend uses this for UX gating only; every admin route re-verifies.
 * The admin panel is visible to a super admin OR the workspace owner (not to
 * ordinary workspace member-admins).
 */
export interface ImagePipelineAdminContext {
  /** In the super-admin allowlist (Fey ADMIN_EMAILS) — app-wide super admin. */
  is_super_admin: boolean
  /** The owner of the active workspace (owner scope). */
  is_workspace_owner: boolean
}

/** Whether the Flow (desktop) channel may be offered to the current client. */
export interface ChannelAvailability {
  channel: GenerationChannel
  online: boolean
  /** Present when unavailable — e.g. "No desktop worker online". */
  reason?: string
}

/* ────────────────────────────────────────────────────────────────────────────
 * API request / response shapes
 * All request bodies are validated with Zod server-side. tier, user_id, owner_id
 * and credit amounts are NEVER trusted from the client — they are derived from
 * the verified session.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * POST /api/v1/image-pipeline/generations.
 * At least one of a reference image or a user prompt must be provided — a run
 * can be image-based, prompt-only, or both.
 */
export interface CreateGenerationRequest {
  /** Reference images (optional), already uploaded via the client-signed flow. */
  source_image_public_ids?: string[]
  source_image_urls?: string[]
  /** The user's own prompt (optional); Claude improves it before generating. */
  user_prompt?: string
  user_notes?: string
  /** Preset key driving the prompt step (built-in key or custom UUID); defaults to 'default'. */
  prompt_preset?: string
  /** 'api' (default) or 'flow'; server rejects 'flow' unless a worker is online. */
  channel?: GenerationChannel
  /** Weeks to keep the images (1 or 2); defaults to the user's saved preference. */
  retention_weeks?: RetentionWeeks
  /** Active workspace, resolved to owner scope server-side. */
  workspace_id?: string
}

export interface CreateGenerationResponse {
  generation: IpGeneration
  /** Balance after the 0.25 preview charge. */
  balance: number
}

/** GET /api/v1/image-pipeline/generations/[id] — status poll fallback for Realtime. */
export interface GetGenerationResponse {
  generation: IpGeneration
}

/** GET /api/v1/image-pipeline/generations */
export interface ListGenerationsResponse {
  generations: IpGeneration[]
}

/** PATCH /api/v1/image-pipeline/generations/[id]/prompt — edit + regenerate preview. */
export interface UpdatePromptRequest {
  final_prompt: string
}

export interface UpdatePromptResponse {
  generation: IpGeneration
  /** Balance after the fresh 0.25 preview charge. */
  balance: number
}

/** POST /api/v1/image-pipeline/generations/[id]/approve — render 2K final. */
export interface ApproveGenerationResponse {
  generation: IpGeneration
  /** Balance after the 0.75 final charge. */
  balance: number
}

/** POST /api/v1/image-pipeline/generations/[id]/reject — delete preview + refund. */
export interface RejectGenerationResponse {
  generation: IpGeneration
}

/** GET /api/v1/image-pipeline/credits */
export interface CreditsSummaryResponse {
  balance: CreditBalance
  ledger: IpCreditLedgerEntry[]
  allocation: IpCreditAllocation | null
}

/** POST /api/v1/image-pipeline/credits (request-only; no payments in v1). */
export interface CreateCreditRequestRequest {
  amount: number
  note?: string
  workspace_id?: string
}

export interface CreateCreditRequestResponse {
  request: IpCreditRequest
}

/* ───── Admin API shapes ───── */

/** A row in the admin user list (tier + skip-review visibility per member). */
export interface AdminUserRow {
  user_id: string
  email: string | null
  display_name: string | null
  resolved_tier: ImageTier
  tier_override: ImageTier | null
  skip_prompt_review: boolean
  balance: number
  allocation: IpCreditAllocation | null
}

/** PATCH admin: set/clear a user's tier override. */
export interface SetTierOverrideRequest {
  user_id: string
  /** null clears the override (falls back to role-based default). */
  image_tier_override: ImageTier | null
  workspace_id?: string
}

/** PUT admin: create/update a user's recurring allocation. */
export interface UpsertAllocationRequest {
  user_id: string
  amount: number
  cadence: AllocationCadence
  workspace_id?: string
}

/** POST admin: grant one-off credits (ledger reason 'manual_grant'). */
export interface ManualGrantRequest {
  user_id: string
  amount: number
  note?: string
  workspace_id?: string
}

/** PATCH admin: approve/deny a pending credit request. */
export interface ResolveCreditRequestRequest {
  request_id: string
  decision: 'approved' | 'denied'
  workspace_id?: string
}

/** PATCH admin: update one or more rate values in place. */
export interface UpdateRatesRequest {
  rates: Partial<RatesMap>
}

/** One user's usage + estimated cost for the admin cost dashboard. */
export interface AdminUsageRow {
  user_id: string
  email: string | null
  display_name: string | null
  credits_used: number
  /** usage × live rates. */
  estimated_spend_usd: number
  /** credits allocated × anchor_cost_per_credit_usd. */
  budgeted_spend_usd: number
}

/** GET admin cost dashboard. */
export interface AdminCostDashboardResponse {
  period: 'week' | 'month'
  rates: IpRateConfig[]
  usage: AdminUsageRow[]
  totals: {
    credits_used: number
    estimated_spend_usd: number
    budgeted_spend_usd: number
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Repository interfaces — THE CONTRACT.
 * Batch 1 Step 2 supplies mock implementations; Batch 2 Step 13 swaps in the
 * real Supabase-backed ones. Neither components nor services change on the swap.
 *
 * Repositories take a Supabase client (user-scoped or service-role, per the
 * caller) as their first argument and contain ONLY queries — no business logic,
 * no charging math. All credit deltas flow through `chargeCredits` (the RPC).
 * ──────────────────────────────────────────────────────────────────────────── */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Owner scope threaded into repository writes. */
export interface OwnerScope {
  user_id: string
  owner_id: string
}

export interface GenerationRepository {
  create(
    db: SupabaseClient,
    scope: OwnerScope,
    input: {
      channel: GenerationChannel
      tier: ImageTier
      source_image_public_ids: string[]
      source_image_urls: string[]
      user_prompt: string | null
      user_notes: string | null
      prompt_preset: string
      retention_weeks: RetentionWeeks
    },
  ): Promise<IpGeneration>
  getById(db: SupabaseClient, id: string): Promise<IpGeneration | null>
  listForUser(db: SupabaseClient, userId: string): Promise<IpGeneration[]>
  /** Partial status/field update; returns the updated row. */
  update(db: SupabaseClient, id: string, patch: Partial<IpGeneration>): Promise<IpGeneration>
  /** Count non-finalized generations for the abuse guard. */
  countInFlight(db: SupabaseClient, userId: string): Promise<number>
}

export interface CreditRepository {
  /**
   * The ONLY path for balance changes — calls the ip_charge_credits SECURITY
   * DEFINER function. Returns the new balance; throws on INSUFFICIENT_CREDITS.
   */
  chargeCredits(
    db: SupabaseClient,
    input: { user_id: string; delta: number; reason: LedgerReason; generation_id: string | null },
  ): Promise<number>
  getBalance(db: SupabaseClient, userId: string): Promise<number>
  listLedger(db: SupabaseClient, userId: string, limit?: number): Promise<IpCreditLedgerEntry[]>
}

export interface AllocationRepository {
  getForUser(db: SupabaseClient, userId: string): Promise<IpCreditAllocation | null>
  upsert(
    db: SupabaseClient,
    scope: OwnerScope,
    input: { amount: number; cadence: AllocationCadence; next_grant_at: string },
  ): Promise<IpCreditAllocation>
  /** Due allocations for the credit-grant cron. */
  listDue(db: SupabaseClient, now: string): Promise<IpCreditAllocation[]>
  advanceNextGrant(db: SupabaseClient, id: string, nextGrantAt: string): Promise<void>
}

export interface CreditRequestRepository {
  create(
    db: SupabaseClient,
    scope: OwnerScope,
    input: { amount: number; note: string | null },
  ): Promise<IpCreditRequest>
  listForOwner(db: SupabaseClient, ownerId: string, status?: CreditRequestStatus): Promise<IpCreditRequest[]>
  resolve(
    db: SupabaseClient,
    id: string,
    input: { status: Exclude<CreditRequestStatus, 'pending'>; resolved_by: string },
  ): Promise<IpCreditRequest>
}

export interface RatesRepository {
  getAll(db: SupabaseClient): Promise<IpRateConfig[]>
  getMap(db: SupabaseClient): Promise<RatesMap>
  update(db: SupabaseClient, key: RateKey, value: number): Promise<IpRateConfig>
}

export interface UserSettingsRepository {
  getForUser(db: SupabaseClient, userId: string): Promise<IpUserSettings | null>
  setTierOverride(db: SupabaseClient, scope: OwnerScope, override: ImageTier | null): Promise<IpUserSettings>
  setSkipPromptReview(db: SupabaseClient, scope: OwnerScope, skip: boolean): Promise<IpUserSettings>
  setRetentionWeeks(db: SupabaseClient, scope: OwnerScope, weeks: RetentionWeeks): Promise<IpUserSettings>
}

export interface FlowRepository {
  enqueue(db: SupabaseClient, generationId: string): Promise<IpFlowJob>
  /** Atomic claim: UPDATE ... WHERE status='queued' RETURNING. */
  claimNext(db: SupabaseClient, workerId: string): Promise<IpFlowJob | null>
  markStatus(
    db: SupabaseClient,
    id: string,
    input: { status: FlowJobStatus; error_message?: string | null },
  ): Promise<IpFlowJob>
  /** Re-queue jobs stuck 'claimed' beyond the timeout (janitor cron). */
  requeueStale(db: SupabaseClient, olderThan: string): Promise<number>
  upsertHeartbeat(db: SupabaseClient, workerId: string): Promise<void>
  getHeartbeats(db: SupabaseClient): Promise<IpWorkerHeartbeat[]>
}
