/**
 * Image Pipeline — mock repositories (Batch 1, Step 2).
 *
 * These implement the repository interfaces from `types/image-pipeline.ts`
 * exactly, backed by the in-memory `state`. The `db: SupabaseClient` argument is
 * accepted (to match the contract) but ignored here. In Batch 2 the real
 * Supabase-backed repositories replace these modules — an import swap only, with
 * zero changes to services, hooks or components.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_RETENTION_WEEKS,
  IN_FLIGHT_STATUSES,
  type AllocationCadence,
  type AllocationRepository,
  type CreditRepository,
  type CreditRequestRepository,
  type FlowJobStatus,
  type FlowRepository,
  type GenerationChannel,
  type GenerationRepository,
  type ImageTier,
  type IpCreditAllocation,
  type IpCreditLedgerEntry,
  type IpCreditRequest,
  type IpFlowJob,
  type IpGeneration,
  type IpRateConfig,
  type IpUserSettings,
  type IpWorkerHeartbeat,
  type LedgerReason,
  type OwnerScope,
  type RateKey,
  type RatesMap,
  type RatesRepository,
  type UserSettingsRepository,
} from '@/types/image-pipeline'
import { balanceOf, findUser, nextId, state } from './store'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const stamp = (): string => new Date().toISOString()

export const mockGenerationRepository: GenerationRepository = {
  async create(_db: SupabaseClient, scope: OwnerScope, input): Promise<IpGeneration> {
    const gen: IpGeneration = {
      id: nextId('gen'),
      user_id: scope.user_id,
      owner_id: scope.owner_id,
      channel: input.channel,
      tier: input.tier,
      status: 'prompting',
      source_image_public_id: input.source_image_public_id,
      source_image_url: input.source_image_url,
      user_prompt: input.user_prompt,
      user_notes: input.user_notes,
      generated_prompt: null,
      final_prompt: null,
      preview_public_id: null,
      preview_url: null,
      final_public_id: null,
      final_url: null,
      error_message: null,
      created_at: stamp(),
      updated_at: stamp(),
      expires_at: new Date(Date.now() + input.retention_weeks * 7 * 24 * 3_600_000).toISOString(),
    }
    state.generations.unshift(gen)
    return clone(gen)
  },

  async getById(_db, id): Promise<IpGeneration | null> {
    const gen = state.generations.find((g) => g.id === id)
    return gen ? clone(gen) : null
  },

  async listForUser(_db, userId): Promise<IpGeneration[]> {
    return state.generations
      .filter((g) => g.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(clone)
  },

  async update(_db, id, patch): Promise<IpGeneration> {
    const gen = state.generations.find((g) => g.id === id)
    if (!gen) throw new Error('DB_QUERY_GENERATION_NOT_FOUND')
    Object.assign(gen, patch, { updated_at: stamp() })
    return clone(gen)
  },

  async countInFlight(_db, userId): Promise<number> {
    return state.generations.filter(
      (g) => g.user_id === userId && (IN_FLIGHT_STATUSES as readonly string[]).includes(g.status),
    ).length
  },
}

export const mockCreditRepository: CreditRepository = {
  async chargeCredits(_db, input): Promise<number> {
    const balance = balanceOf(input.user_id)
    if (input.delta < 0 && balance + input.delta < 0) {
      throw new Error('INSUFFICIENT_CREDITS')
    }
    const entry: IpCreditLedgerEntry = {
      id: nextId('led'),
      user_id: input.user_id,
      owner_id: findUser(input.user_id) ? state.currentUserId : input.user_id,
      delta: input.delta,
      reason: input.reason,
      generation_id: input.generation_id,
      created_by: null,
      created_at: stamp(),
    }
    // owner_id resolves to the generation's owner when present, else the user.
    const gen = input.generation_id ? state.generations.find((g) => g.id === input.generation_id) : null
    if (gen) entry.owner_id = gen.owner_id
    state.ledger.push(entry)
    return Math.round((balance + input.delta) * 100) / 100
  },

  async getBalance(_db, userId): Promise<number> {
    return balanceOf(userId)
  },

  async listLedger(_db, userId, limit = 100): Promise<IpCreditLedgerEntry[]> {
    return state.ledger
      .filter((l) => l.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map(clone)
  },
}

/** Admin-only insert used for manual grants / request approvals (reason-tagged). */
export function mockInsertLedger(input: {
  user_id: string
  owner_id: string
  delta: number
  reason: LedgerReason
  created_by: string
}): IpCreditLedgerEntry {
  const entry: IpCreditLedgerEntry = {
    id: nextId('led'),
    user_id: input.user_id,
    owner_id: input.owner_id,
    delta: input.delta,
    reason: input.reason,
    generation_id: null,
    created_by: input.created_by,
    created_at: stamp(),
  }
  state.ledger.push(entry)
  return clone(entry)
}

export const mockAllocationRepository: AllocationRepository = {
  async getForUser(_db, userId): Promise<IpCreditAllocation | null> {
    const a = state.allocations.find((x) => x.user_id === userId)
    return a ? clone(a) : null
  },

  async upsert(_db, scope, input): Promise<IpCreditAllocation> {
    const existing = state.allocations.find((x) => x.user_id === scope.user_id)
    if (existing) {
      Object.assign(existing, { amount: input.amount, cadence: input.cadence, next_grant_at: input.next_grant_at, updated_at: stamp() })
      return clone(existing)
    }
    const created: IpCreditAllocation = {
      id: nextId('alloc'),
      user_id: scope.user_id,
      owner_id: scope.owner_id,
      amount: input.amount,
      cadence: input.cadence,
      next_grant_at: input.next_grant_at,
      created_at: stamp(),
      updated_at: stamp(),
    }
    state.allocations.push(created)
    return clone(created)
  },

  async listDue(_db, nowIso): Promise<IpCreditAllocation[]> {
    return state.allocations.filter((a) => a.next_grant_at <= nowIso).map(clone)
  },

  async advanceNextGrant(_db, id, nextGrantAt): Promise<void> {
    const a = state.allocations.find((x) => x.id === id)
    if (a) { a.next_grant_at = nextGrantAt; a.updated_at = stamp() }
  },
}

export const mockCreditRequestRepository: CreditRequestRepository = {
  async create(_db, scope, input): Promise<IpCreditRequest> {
    const req: IpCreditRequest = {
      id: nextId('req'),
      user_id: scope.user_id,
      owner_id: scope.owner_id,
      amount: input.amount,
      note: input.note,
      status: 'pending',
      resolved_by: null,
      created_at: stamp(),
      updated_at: stamp(),
    }
    state.requests.unshift(req)
    return clone(req)
  },

  async listForOwner(_db, ownerId, status): Promise<IpCreditRequest[]> {
    return state.requests
      .filter((r) => r.owner_id === ownerId && (status ? r.status === status : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(clone)
  },

  async resolve(_db, id, input): Promise<IpCreditRequest> {
    const req = state.requests.find((r) => r.id === id)
    if (!req) throw new Error('DB_QUERY_REQUEST_NOT_FOUND')
    Object.assign(req, { status: input.status, resolved_by: input.resolved_by, updated_at: stamp() })
    return clone(req)
  },
}

export const mockRatesRepository: RatesRepository = {
  async getAll(_db): Promise<IpRateConfig[]> {
    return state.rates.map(clone)
  },

  async getMap(_db): Promise<RatesMap> {
    return state.rates.reduce((m, r) => { m[r.key] = r.value; return m }, {} as RatesMap)
  },

  async update(_db, key: RateKey, value: number): Promise<IpRateConfig> {
    const rate = state.rates.find((r) => r.key === key)
    if (!rate) throw new Error('DB_QUERY_RATE_NOT_FOUND')
    rate.value = value
    rate.updated_at = stamp()
    return clone(rate)
  },
}

export const mockUserSettingsRepository: UserSettingsRepository = {
  async getForUser(_db, userId): Promise<IpUserSettings | null> {
    const s = state.settings.find((x) => x.user_id === userId)
    return s ? clone(s) : null
  },

  async setTierOverride(_db, scope, override: ImageTier | null): Promise<IpUserSettings> {
    return upsertSettings(scope, { image_tier_override: override })
  },

  async setSkipPromptReview(_db, scope, skip: boolean): Promise<IpUserSettings> {
    return upsertSettings(scope, { skip_prompt_review: skip })
  },

  async setRetentionWeeks(_db, scope, weeks): Promise<IpUserSettings> {
    return upsertSettings(scope, { retention_weeks: weeks })
  },
}

function upsertSettings(scope: OwnerScope, patch: Partial<IpUserSettings>): IpUserSettings {
  const existing = state.settings.find((s) => s.user_id === scope.user_id)
  if (existing) {
    Object.assign(existing, patch, { updated_at: stamp() })
    return clone(existing)
  }
  const created: IpUserSettings = {
    user_id: scope.user_id,
    owner_id: scope.owner_id,
    image_tier_override: patch.image_tier_override ?? null,
    skip_prompt_review: patch.skip_prompt_review ?? false,
    retention_weeks: patch.retention_weeks ?? DEFAULT_RETENTION_WEEKS,
    updated_at: stamp(),
  }
  state.settings.push(created)
  return clone(created)
}

export const mockFlowRepository: FlowRepository = {
  async enqueue(_db, generationId): Promise<IpFlowJob> {
    const job: IpFlowJob = {
      id: nextId('flow'),
      generation_id: generationId,
      status: 'queued',
      attempts: 0,
      claimed_at: null,
      error_message: null,
      created_at: stamp(),
      updated_at: stamp(),
    }
    state.flowJobs.push(job)
    return clone(job)
  },

  async claimNext(_db, _workerId): Promise<IpFlowJob | null> {
    const job = state.flowJobs.find((j) => j.status === 'queued')
    if (!job) return null
    job.status = 'claimed'
    job.claimed_at = stamp()
    job.attempts += 1
    job.updated_at = stamp()
    return clone(job)
  },

  async markStatus(_db, id, input: { status: FlowJobStatus; error_message?: string | null }): Promise<IpFlowJob> {
    const job = state.flowJobs.find((j) => j.id === id)
    if (!job) throw new Error('DB_QUERY_FLOW_JOB_NOT_FOUND')
    job.status = input.status
    if (input.error_message !== undefined) job.error_message = input.error_message
    job.updated_at = stamp()
    return clone(job)
  },

  async requeueStale(_db, olderThan): Promise<number> {
    let count = 0
    for (const job of state.flowJobs) {
      if (job.status === 'claimed' && job.claimed_at && job.claimed_at < olderThan && job.attempts < 2) {
        job.status = 'queued'
        job.claimed_at = null
        job.updated_at = stamp()
        count += 1
      }
    }
    return count
  },

  async upsertHeartbeat(_db, workerId): Promise<void> {
    const hb = state.heartbeats.find((h) => h.worker_id === workerId)
    if (hb) hb.last_seen = stamp()
    else state.heartbeats.push({ worker_id: workerId, last_seen: stamp() })
  },

  async getHeartbeats(_db): Promise<IpWorkerHeartbeat[]> {
    return state.heartbeats.map(clone)
  },
}

// Re-export a couple of types used by callers so imports stay in one place.
export type { AllocationCadence, GenerationChannel }
