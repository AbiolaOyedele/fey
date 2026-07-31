import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { isAdminEmail } from '@/config/env'
import {
  allocationRepository as allocations,
  balancesFor,
  creditRequestRepository as requests,
  grantCredits,
  listAllocationsForOwner,
  listOwnerLedgerSince,
} from '@/repositories/image-pipeline/credit.repository'
import {
  ratesRepository as rates,
  settingsFor,
  userSettingsRepository as settingsRepo,
} from '@/repositories/image-pipeline/settings.repository'
import {
  ALLOCATION_CADENCES,
  IMAGE_TIERS,
  RATE_KEYS,
  type AdminCostDashboardResponse,
  type AdminUsageRow,
  type AdminUserRow,
  type IpCreditRequest,
  type IpRateConfig,
  type ImageTier,
  type RateKey,
} from '@/types/image-pipeline'
import { isPipelineAdmin, resolveAdminContext, resolveTierFor, type PipelineCtx } from './tier.service'
import { notifyCreditsGranted, notifyCreditRequestResolved } from './notify'

/**
 * Admin operations for the Image Pipeline: member tiers, allocations, credit
 * requests, rates, and the cost dashboard.
 *
 * Every function re-verifies admin rights server-side from the verified
 * session — the frontend's gating is UX only. Admin here means the platform
 * super admin (ADMIN_EMAILS) or the owner of the active workspace.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function assertAdmin(ctx: PipelineCtx): void {
  if (!isPipelineAdmin(ctx)) {
    throw new AppError(403, 'You don’t have access to that.', 'IP_ADMIN_FORBIDDEN')
  }
}

/**
 * Rates are global platform config, not per-workspace, so only the platform
 * super admin may change them — a workspace owner can read them (the cost
 * dashboard needs them) but not edit.
 */
function assertSuperAdmin(ctx: PipelineCtx): void {
  if (!isAdminEmail(ctx.email)) {
    throw new AppError(403, 'Only a platform admin can change the rate card.', 'IP_RATES_FORBIDDEN')
  }
}

interface ScopeMember {
  user_id: string
  email: string | null
  display_name: string | null
}

/**
 * Members administered in this owner scope: the owner plus their workspace
 * members. Reads through the caller's own client, so RLS still applies.
 */
async function listScopeMembers(db: SupabaseClient, ctx: PipelineCtx): Promise<ScopeMember[]> {
  const members = new Map<string, ScopeMember>()
  members.set(ctx.ownerId, { user_id: ctx.ownerId, email: null, display_name: null })

  const { data, error } = await db
    .from('workspace_members')
    .select('user_id, name, email, workspaces!inner ( owner_id )')
    .eq('workspaces.owner_id', ctx.ownerId)
  if (error) throw error

  for (const row of data ?? []) {
    const r = row as { user_id: string; name: string | null; email: string | null }
    members.set(r.user_id, { user_id: r.user_id, email: r.email, display_name: r.name })
  }
  // The caller always sees themselves with their own known email.
  const self = members.get(ctx.userId)
  if (self) members.set(ctx.userId, { ...self, email: self.email ?? ctx.email ?? null })
  return [...members.values()]
}

export async function adminListUsers(db: SupabaseClient, ctx: PipelineCtx): Promise<AdminUserRow[]> {
  assertAdmin(ctx)
  const members = await listScopeMembers(db, ctx)
  const userIds = members.map((m) => m.user_id)

  const [settings, balances, allocationRows] = await Promise.all([
    settingsFor(db, userIds),
    balancesFor(db, userIds),
    listAllocationsForOwner(db, ctx.ownerId),
  ])
  const allocationByUser = new Map(allocationRows.map((a) => [a.user_id, a]))

  return members.map((member): AdminUserRow => {
    const s = settings[member.user_id]
    const override = s?.image_tier_override ?? null
    return {
      user_id: member.user_id,
      email: member.email,
      display_name: member.display_name,
      resolved_tier: resolveTierFor(override, member.user_id === ctx.ownerId),
      tier_override: override,
      skip_prompt_review: s?.skip_prompt_review ?? false,
      balance: balances[member.user_id] ?? 0,
      allocation: allocationByUser.get(member.user_id) ?? null,
    }
  })
}

const tierOverrideSchema = z.object({
  user_id: z.string().uuid(),
  image_tier_override: z.enum(IMAGE_TIERS).nullable(),
})

export async function adminSetTierOverride(db: SupabaseClient, ctx: PipelineCtx, input: unknown): Promise<void> {
  assertAdmin(ctx)
  const parsed = tierOverrideSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, 'That tier change isn’t valid.', 'IP_ADMIN_INVALID')
  await assertInScope(db, ctx, parsed.data.user_id)
  await settingsRepo.setTierOverride(
    db,
    { user_id: parsed.data.user_id, owner_id: ctx.ownerId },
    parsed.data.image_tier_override,
  )
}

const allocationSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.number().min(0).max(10_000),
  cadence: z.enum(ALLOCATION_CADENCES),
})

export async function adminUpsertAllocation(db: SupabaseClient, ctx: PipelineCtx, input: unknown): Promise<void> {
  assertAdmin(ctx)
  const parsed = allocationSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, 'That allocation isn’t valid.', 'IP_ADMIN_INVALID')
  const d = parsed.data
  await assertInScope(db, ctx, d.user_id)

  const existing = await allocations.getForUser(db, d.user_id)
  // Keep an existing schedule intact so editing the amount doesn't reset the clock.
  const nextGrantAt = existing?.next_grant_at ?? new Date(Date.now() + cadenceMs(d.cadence)).toISOString()
  await allocations.upsert(
    db,
    { user_id: d.user_id, owner_id: ctx.ownerId },
    { amount: d.amount, cadence: d.cadence, next_grant_at: nextGrantAt },
  )
}

const grantSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.number().positive().max(10_000),
  note: z.string().trim().max(500).optional(),
})

export async function adminManualGrant(db: SupabaseClient, ctx: PipelineCtx, input: unknown): Promise<void> {
  assertAdmin(ctx)
  const parsed = grantSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, 'That grant isn’t valid.', 'IP_ADMIN_INVALID')
  await assertInScope(db, ctx, parsed.data.user_id)
  await grantCredits(db, {
    user_id: parsed.data.user_id,
    delta: parsed.data.amount,
    reason: 'manual_grant',
    created_by: ctx.userId,
  })
  await notifyCreditsGranted({
    recipientId: parsed.data.user_id,
    actorId: ctx.userId,
    amount: parsed.data.amount,
  })
}

export async function adminListRequests(db: SupabaseClient, ctx: PipelineCtx): Promise<IpCreditRequest[]> {
  assertAdmin(ctx)
  return requests.listForOwner(db, ctx.ownerId)
}

const resolveSchema = z.object({
  request_id: z.string().uuid(),
  decision: z.enum(['approved', 'denied']),
})

export async function adminResolveRequest(db: SupabaseClient, ctx: PipelineCtx, input: unknown): Promise<void> {
  assertAdmin(ctx)
  const parsed = resolveSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, 'That decision isn’t valid.', 'IP_ADMIN_INVALID')

  // resolve() only matches a row still 'pending', so approving twice can't
  // grant the credits twice.
  let resolved: IpCreditRequest
  try {
    resolved = await requests.resolve(db, parsed.data.request_id, {
      status: parsed.data.decision,
      resolved_by: ctx.userId,
    })
  } catch {
    throw new AppError(409, 'That request has already been dealt with.', 'IP_REQUEST_ALREADY_RESOLVED')
  }

  if (parsed.data.decision === 'approved') {
    await grantCredits(db, {
      user_id: resolved.user_id,
      delta: resolved.amount,
      reason: 'request_approved',
      created_by: ctx.userId,
    })
  }

  await notifyCreditRequestResolved({
    recipientId: resolved.user_id,
    actorId: ctx.userId,
    decision: parsed.data.decision,
    amount: resolved.amount,
  })
}

export async function adminGetRates(db: SupabaseClient, ctx: PipelineCtx): Promise<IpRateConfig[]> {
  assertAdmin(ctx)
  return rates.getAll(db)
}

const ratesSchema = z.object({
  rates: z.record(z.enum(RATE_KEYS), z.number().min(0).max(1000)),
})

/**
 * Updates rate values in place. Service-role client: ip_rates_config is global
 * and has no owner column, so it has no user write policy — the super-admin
 * check above is the gate.
 */
export async function adminUpdateRates(
  db: SupabaseClient,
  serviceDb: SupabaseClient,
  ctx: PipelineCtx,
  input: unknown,
): Promise<IpRateConfig[]> {
  assertAdmin(ctx)
  assertSuperAdmin(ctx)
  const parsed = ratesSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, 'Those rates aren’t valid.', 'IP_RATES_INVALID')

  for (const [key, value] of Object.entries(parsed.data.rates)) {
    if (value === undefined) continue
    await rates.update(serviceDb, key as RateKey, value)
  }
  return rates.getAll(db)
}

/** Per-user credit usage and estimated spend for the period. */
export async function adminCostDashboard(
  db: SupabaseClient,
  ctx: PipelineCtx,
  period: 'week' | 'month',
): Promise<AdminCostDashboardResponse> {
  assertAdmin(ctx)
  const since = new Date(Date.now() - (period === 'week' ? 7 : 30) * DAY_MS).toISOString()

  const [members, rateRows, rateMap, ledger, allocationRows, settings] = await Promise.all([
    listScopeMembers(db, ctx),
    rates.getAll(db),
    rates.getMap(db),
    listOwnerLedgerSince(db, ctx.ownerId, since),
    listAllocationsForOwner(db, ctx.ownerId),
    settingsFor(db, (await listScopeMembers(db, ctx)).map((m) => m.user_id)),
  ])

  const anchor = rateMap.anchor_cost_per_credit_usd
  const usdPerCredit = (tier: ImageTier): number =>
    tier === 'pro'
      ? rateMap.pro_preview_usd + rateMap.pro_final_2k_usd + rateMap.prompt_sonnet_est_usd
      : rateMap.std_preview_usd + rateMap.std_final_2k_usd + rateMap.prompt_haiku_est_usd

  const spentByUser = new Map<string, number>()
  for (const entry of ledger) {
    if (entry.delta >= 0) continue // grants aren't usage
    spentByUser.set(entry.user_id, (spentByUser.get(entry.user_id) ?? 0) + Math.abs(entry.delta))
  }
  const allocationByUser = new Map(allocationRows.map((a) => [a.user_id, a]))

  const usage: AdminUsageRow[] = members.map((member) => {
    const used = round2(spentByUser.get(member.user_id) ?? 0)
    const tier = resolveTierFor(
      settings[member.user_id]?.image_tier_override ?? null,
      member.user_id === ctx.ownerId,
    )
    return {
      user_id: member.user_id,
      email: member.email,
      display_name: member.display_name,
      credits_used: used,
      estimated_spend_usd: round2(used * usdPerCredit(tier)),
      budgeted_spend_usd: round2((allocationByUser.get(member.user_id)?.amount ?? 0) * anchor),
    }
  })

  const totals = usage.reduce(
    (acc, row) => ({
      credits_used: round2(acc.credits_used + row.credits_used),
      estimated_spend_usd: round2(acc.estimated_spend_usd + row.estimated_spend_usd),
      budgeted_spend_usd: round2(acc.budgeted_spend_usd + row.budgeted_spend_usd),
    }),
    { credits_used: 0, estimated_spend_usd: 0, budgeted_spend_usd: 0 },
  )

  return { period, rates: rateRows, usage, totals }
}

/** Guards against an admin acting on a user outside their own owner scope. */
async function assertInScope(db: SupabaseClient, ctx: PipelineCtx, userId: string): Promise<void> {
  if (userId === ctx.ownerId || userId === ctx.userId) return
  const members = await listScopeMembers(db, ctx)
  if (!members.some((m) => m.user_id === userId)) {
    throw new AppError(403, 'That person isn’t in this workspace.', 'IP_ADMIN_OUT_OF_SCOPE')
  }
}

const cadenceMs = (cadence: 'weekly' | 'monthly'): number => (cadence === 'weekly' ? 7 : 30) * DAY_MS
const round2 = (n: number): number => Math.round(n * 100) / 100

export { resolveAdminContext }
