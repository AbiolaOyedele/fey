/**
 * Image Pipeline — mock service/API facade (Batch 1).
 *
 * The hooks import ONLY from here. It orchestrates the mock repositories the way
 * the real services will: server-side tier resolution, the abuse guard, atomic
 * credit charges, and the two-gate state machine (prompt → 1K preview → approve
 * → 2K final). Async AI steps are faked with timers; status transitions are
 * pushed through the `subscribeGeneration` pub/sub, standing in for Supabase
 * Realtime. In Batch 2 each function here becomes an `apiFetch` call — the hook
 * signatures do not change.
 *
 * Security note (enforced for real in Batch 2, modelled here): tier, user_id,
 * owner_id and credit amounts are derived server-side. Nothing the client sends
 * about those is trusted.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CREDIT_COST,
  DEFAULT_RETENTION_WEEKS,
  type AdminCostDashboardResponse,
  type AdminUsageRow,
  type AdminUserRow,
  type AllocationCadence,
  type ChannelAvailability,
  type CreditBalance,
  type GenerationChannel,
  type ImagePipelineAdminContext,
  type ImageTier,
  type IpCreditAllocation,
  type IpCreditLedgerEntry,
  type IpCreditRequest,
  type IpGeneration,
  type IpRateConfig,
  type RateKey,
  type RetentionWeeks,
  type TierResolution,
} from '@/types/image-pipeline'
import {
  balanceOf,
  emitGeneration,
  findUser,
  resolveTier,
  state,
  subscribeGeneration,
} from './store'
import {
  mockAllocationRepository as allocations,
  mockCreditRepository as credits,
  mockCreditRequestRepository as requests,
  mockGenerationRepository as generations,
  mockInsertLedger,
  mockRatesRepository as rates,
  mockUserSettingsRepository as settings,
} from './repositories'

/** Repos accept a client to match the contract; the mock ignores it. */
const db = null as unknown as SupabaseClient
const meId = () => state.currentUserId
const ownerScope = () => ({ user_id: meId(), owner_id: state.currentUserId })

const DAY = 24 * 3_600_000
const after = (ms: number, fn: () => void): void => { setTimeout(fn, ms) }
let previewSeq = 0
const mockAsset = (kind: 'preview' | 'final', genId: string): { url: string; publicId: string } => {
  previewSeq += 1
  const size = kind === 'final' ? 1600 : 800
  return {
    url: `https://picsum.photos/seed/${genId}-${kind}-${previewSeq}/${size}/${size}`,
    publicId: `image-pipeline/${meId()}/${genId}/${kind}`,
  }
}

export { subscribeGeneration }

/* ────────────────────────────────────────────────────────────────────────────
 * Context — admin flags, tier, personal settings, balance
 * ──────────────────────────────────────────────────────────────────────────── */

export interface PipelineContext {
  admin: ImagePipelineAdminContext
  tier: TierResolution
  skip_prompt_review: boolean
  retention_weeks: RetentionWeeks
  balance: number
}

export async function getContext(): Promise<PipelineContext> {
  const me = findUser(meId())
  const mySettings = await settings.getForUser(db, meId())
  const tier = resolveTier(meId())
  const source: TierResolution['source'] = mySettings?.image_tier_override
    ? 'override'
    : tier === 'pro'
      ? 'admin_default'
      : 'standard_default'
  return {
    admin: {
      is_super_admin: !!me?.is_super_admin,
      is_workspace_owner: me?.role === 'owner',
    },
    tier: { tier, source },
    skip_prompt_review: mySettings?.skip_prompt_review ?? false,
    retention_weeks: mySettings?.retention_weeks ?? DEFAULT_RETENTION_WEEKS,
    balance: balanceOf(meId()),
  }
}

/** Persist the user's default retention preference (1 or 2 weeks). */
export async function setRetentionWeeks(weeks: RetentionWeeks): Promise<void> {
  await settings.setRetentionWeeks(db, ownerScope(), weeks)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Channels
 * ──────────────────────────────────────────────────────────────────────────── */

/** Worker considered offline after 90s without a heartbeat. */
function flowOnline(): boolean {
  const hb = state.heartbeats[0]
  if (!hb) return false
  return Date.now() - new Date(hb.last_seen).getTime() < 90_000
}

export async function getChannelAvailability(): Promise<ChannelAvailability[]> {
  const online = flowOnline()
  return [
    { channel: 'api', online: true },
    online
      ? { channel: 'flow', online: true }
      : { channel: 'flow', online: false, reason: 'No desktop worker online' },
  ]
}

/* ────────────────────────────────────────────────────────────────────────────
 * Generation state machine
 * ──────────────────────────────────────────────────────────────────────────── */

const ensureBalance = async (need: number): Promise<void> => {
  if (balanceOf(meId()) < need) throw new Error('INSUFFICIENT_CREDITS')
}

/** Simulate the 1K preview render, then flip to preview_ready. */
function renderPreview(genId: string, finalPrompt: string): void {
  after(1400, () => {
    const asset = mockAsset('preview', genId)
    void generations
      .update(db, genId, {
        status: 'preview_ready',
        final_prompt: finalPrompt,
        preview_url: asset.url,
        preview_public_id: asset.publicId,
      })
      .then(emitGeneration)
  })
}

export interface StartGenerationInput {
  source_image_public_id?: string
  source_image_url?: string
  user_prompt?: string
  user_notes?: string
  channel?: GenerationChannel
  retention_weeks?: RetentionWeeks
}

/**
 * Start a run: derive tier, enforce the in-flight guard, charge 0.25 for the
 * preview, create the row, then simulate prompt generation. A run needs at
 * least a reference image OR a user prompt. Honours skip_prompt_review (prompt
 * still returned + editable).
 */
export async function startGeneration(input: StartGenerationInput): Promise<IpGeneration> {
  const channel: GenerationChannel = input.channel ?? 'api'
  if (channel === 'flow' && !flowOnline()) throw new Error('FLOW_WORKER_OFFLINE')

  const hasImage = !!input.source_image_url
  const hasPrompt = !!input.user_prompt?.trim()
  if (!hasImage && !hasPrompt) throw new Error('NO_INPUT')

  const inFlight = await generations.countInFlight(db, meId())
  if (inFlight >= 3) throw new Error('TOO_MANY_IN_FLIGHT')

  await ensureBalance(CREDIT_COST.preview)
  const tier = resolveTier(meId())
  const mySettings = await settings.getForUser(db, meId())
  const retention = input.retention_weeks ?? mySettings?.retention_weeks ?? DEFAULT_RETENTION_WEEKS

  const gen = await generations.create(db, ownerScope(), {
    channel,
    tier,
    source_image_public_id: input.source_image_public_id ?? null,
    source_image_url: input.source_image_url ?? null,
    user_prompt: input.user_prompt?.trim() ? input.user_prompt.trim() : null,
    user_notes: input.user_notes ?? null,
    retention_weeks: retention,
  })
  await credits.chargeCredits(db, { user_id: meId(), delta: -CREDIT_COST.preview, reason: 'preview_charge', generation_id: gen.id })

  const skip = mySettings?.skip_prompt_review ?? false

  // Simulate the prompt model returning a detailed prompt.
  after(1000, () => {
    const generated = mockPromptFor({ userPrompt: input.user_prompt, notes: input.user_notes, hasImage })
    if (skip) {
      // Straight to preview; prompt is still shown and editable in the UI.
      void generations
        .update(db, gen.id, { status: 'generating_preview', generated_prompt: generated, final_prompt: generated })
        .then((g) => { emitGeneration(g); renderPreview(gen.id, generated) })
    } else {
      void generations
        .update(db, gen.id, { status: 'prompt_review', generated_prompt: generated })
        .then(emitGeneration)
    }
  })

  return gen
}

/**
 * Confirm the prompt at gate 1 (text may have been edited). Renders the FIRST
 * preview — already paid for by the start charge, so no additional charge here.
 */
export async function confirmPrompt(genId: string, finalPrompt: string): Promise<IpGeneration> {
  const gen = await generations.update(db, genId, { status: 'generating_preview', final_prompt: finalPrompt })
  emitGeneration(gen)
  renderPreview(genId, finalPrompt)
  return gen
}

/**
 * Edit the prompt AFTER a preview exists (gate 2) and regenerate — this is an
 * additional preview, so it charges another 0.25.
 */
export async function editPrompt(genId: string, finalPrompt: string): Promise<IpGeneration> {
  await ensureBalance(CREDIT_COST.preview)
  await credits.chargeCredits(db, { user_id: meId(), delta: -CREDIT_COST.preview, reason: 'preview_charge', generation_id: genId })
  const gen = await generations.update(db, genId, {
    status: 'generating_preview',
    final_prompt: finalPrompt,
    preview_url: null,
    preview_public_id: null,
  })
  emitGeneration(gen)
  renderPreview(genId, finalPrompt)
  return gen
}

/** Approve the preview → charge 0.75 → render the 2K final. */
export async function approveGeneration(genId: string): Promise<IpGeneration> {
  await ensureBalance(CREDIT_COST.final)
  await credits.chargeCredits(db, { user_id: meId(), delta: -CREDIT_COST.final, reason: 'final_charge', generation_id: genId })
  const gen = await generations.update(db, genId, { status: 'generating_final' })
  emitGeneration(gen)
  after(1800, () => {
    const asset = mockAsset('final', genId)
    void generations
      .update(db, genId, { status: 'complete', final_url: asset.url, final_public_id: asset.publicId })
      .then(emitGeneration)
  })
  return gen
}

/**
 * Reject the preview — no further charge (0.25 already spent). The preview image
 * is RETAINED and auto-deletes on the generation's expiry like any other image
 * (it is no longer removed immediately).
 */
export async function rejectGeneration(genId: string): Promise<IpGeneration> {
  const gen = await generations.update(db, genId, { status: 'rejected' })
  emitGeneration(gen)
  return gen
}

export async function getGeneration(genId: string): Promise<IpGeneration | null> {
  return generations.getById(db, genId)
}

export async function listGenerations(): Promise<IpGeneration[]> {
  return generations.listForUser(db, meId())
}

function mockPromptFor(input: { userPrompt: string | undefined; notes: string | undefined; hasImage: boolean }): string {
  const base = 'A richly detailed, professionally lit image with balanced composition, natural colour grading and sharp focus'
  // Prompt-only run: Claude "improves" the user's own prompt.
  if (input.userPrompt?.trim()) {
    const extra = input.notes?.trim() ? ` ${input.notes.trim()}.` : ''
    return `${input.userPrompt.trim()} — rendered as ${base.toLowerCase()}.${extra}`
  }
  if (input.notes?.trim()) return `${base}. Direction: ${input.notes.trim()}.`
  return input.hasImage ? `${base}, faithful to the reference subject and framing.` : base
}

/* ────────────────────────────────────────────────────────────────────────────
 * Credits (per-user)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function getCreditsSummary(): Promise<{
  balance: CreditBalance
  ledger: IpCreditLedgerEntry[]
  allocation: IpCreditAllocation | null
}> {
  return {
    balance: { balance: balanceOf(meId()), cost_per_run: CREDIT_COST.preview + CREDIT_COST.final },
    ledger: await credits.listLedger(db, meId()),
    allocation: await allocations.getForUser(db, meId()),
  }
}

export async function requestCredits(amount: number, note?: string): Promise<IpCreditRequest> {
  return requests.create(db, ownerScope(), { amount, note: note?.trim() ? note.trim() : null })
}

/* ────────────────────────────────────────────────────────────────────────────
 * Admin (platform or workspace admin)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const owner = state.currentUserId
  return Promise.all(
    state.users
      .filter((u) => u.id === owner || u.role !== 'owner') // owner + members in scope
      .map(async (u): Promise<AdminUserRow> => {
        const s = await settings.getForUser(db, u.id)
        return {
          user_id: u.id,
          email: u.email,
          display_name: u.display_name,
          resolved_tier: resolveTier(u.id),
          tier_override: s?.image_tier_override ?? null,
          skip_prompt_review: s?.skip_prompt_review ?? false,
          balance: balanceOf(u.id),
          allocation: await allocations.getForUser(db, u.id),
        }
      }),
  )
}

export async function adminSetTierOverride(userId: string, override: ImageTier | null): Promise<void> {
  await settings.setTierOverride(db, { user_id: userId, owner_id: state.currentUserId }, override)
}

export async function adminUpsertAllocation(userId: string, amount: number, cadence: AllocationCadence): Promise<void> {
  const nextGrant = new Date(Date.now() + (cadence === 'weekly' ? 7 : 30) * DAY).toISOString()
  await allocations.upsert(db, { user_id: userId, owner_id: state.currentUserId }, { amount, cadence, next_grant_at: nextGrant })
}

export async function adminManualGrant(userId: string, amount: number): Promise<void> {
  mockInsertLedger({ user_id: userId, owner_id: state.currentUserId, delta: amount, reason: 'manual_grant', created_by: meId() })
}

export async function adminListRequests(): Promise<IpCreditRequest[]> {
  return requests.listForOwner(db, state.currentUserId)
}

export async function adminResolveRequest(requestId: string, decision: 'approved' | 'denied'): Promise<void> {
  const req = state.requests.find((r) => r.id === requestId)
  if (!req) throw new Error('DB_QUERY_REQUEST_NOT_FOUND')
  await requests.resolve(db, requestId, { status: decision, resolved_by: meId() })
  if (decision === 'approved') {
    mockInsertLedger({ user_id: req.user_id, owner_id: req.owner_id, delta: req.amount, reason: 'request_approved', created_by: meId() })
  }
}

export async function adminGetRates(): Promise<IpRateConfig[]> {
  return rates.getAll(db)
}

export async function adminUpdateRate(key: RateKey, value: number): Promise<IpRateConfig> {
  return rates.update(db, key, value)
}

export async function adminCostDashboard(period: 'week' | 'month'): Promise<AdminCostDashboardResponse> {
  const windowMs = (period === 'week' ? 7 : 30) * DAY
  const since = Date.now() - windowMs
  const rateMap = await rates.getMap(db)
  const anchor = rateMap.anchor_cost_per_credit_usd

  const usdPerCredit = (tier: ImageTier): number =>
    tier === 'pro'
      ? rateMap.pro_preview_usd + rateMap.pro_final_2k_usd + rateMap.prompt_sonnet_est_usd
      : rateMap.std_preview_usd + rateMap.std_final_2k_usd + rateMap.prompt_haiku_est_usd

  const usage: AdminUsageRow[] = state.users
    .filter((u) => u.id === state.currentUserId || u.role !== 'owner')
    .map((u) => {
      const used = Math.abs(
        state.ledger
          .filter((l) => l.user_id === u.id && l.delta < 0 && new Date(l.created_at).getTime() >= since)
          .reduce((s, l) => s + l.delta, 0),
      )
      const alloc = state.allocations.find((a) => a.user_id === u.id)
      return {
        user_id: u.id,
        email: u.email,
        display_name: u.display_name,
        credits_used: Math.round(used * 100) / 100,
        estimated_spend_usd: Math.round(used * usdPerCredit(resolveTier(u.id)) * 100) / 100,
        budgeted_spend_usd: Math.round((alloc?.amount ?? 0) * anchor * 100) / 100,
      }
    })

  const totals = usage.reduce(
    (t, r) => ({
      credits_used: Math.round((t.credits_used + r.credits_used) * 100) / 100,
      estimated_spend_usd: Math.round((t.estimated_spend_usd + r.estimated_spend_usd) * 100) / 100,
      budgeted_spend_usd: Math.round((t.budgeted_spend_usd + r.budgeted_spend_usd) * 100) / 100,
    }),
    { credits_used: 0, estimated_spend_usd: 0, budgeted_spend_usd: 0 },
  )

  return { period, rates: await rates.getAll(db), usage, totals }
}
