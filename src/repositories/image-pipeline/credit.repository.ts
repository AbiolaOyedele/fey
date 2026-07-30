import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AllocationRepository,
  CreditRepository,
  CreditRequestRepository,
  IpCreditAllocation,
  IpCreditLedgerEntry,
  IpCreditRequest,
} from '@/types/image-pipeline'

/**
 * Queries for the credit tables. The ONLY way a balance ever changes is the
 * ip_charge_credits RPC below — the ledger has no INSERT policy, so there is
 * no other path from application code, and no balance math lives here.
 */

const LEDGER_SELECT = 'id, user_id, owner_id, delta, reason, generation_id, created_by, created_at'
const ALLOCATION_SELECT = 'id, user_id, owner_id, amount, cadence, next_grant_at, created_at, updated_at'
const REQUEST_SELECT = 'id, user_id, owner_id, amount, note, status, resolved_by, created_at, updated_at'

/** Postgres raises this when a charge would take the balance below zero. */
const INSUFFICIENT = 'INSUFFICIENT_CREDITS'

export const creditRepository: CreditRepository = {
  async chargeCredits(db, input) {
    const { data, error } = await db.rpc('ip_charge_credits', {
      p_user_id: input.user_id,
      p_delta: input.delta,
      p_reason: input.reason,
      p_generation_id: input.generation_id,
    })
    if (error) {
      // Surface the balance guard as a recognisable error for the service layer.
      if (error.message.includes(INSUFFICIENT)) throw new Error(INSUFFICIENT)
      throw error
    }
    return Number(data)
  },

  async getBalance(db, userId) {
    const { data, error } = await db
      .from('ip_credit_ledger')
      .select('delta')
      .eq('user_id', userId)
    if (error) throw error
    const total = (data ?? []).reduce((sum, row) => sum + Number((row as { delta: number }).delta), 0)
    return Math.round(total * 100) / 100
  },

  async listLedger(db, userId, limit = 100) {
    const { data, error } = await db
      .from('ip_credit_ledger')
      .select(LEDGER_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(toLedgerEntry)
  },
}

/**
 * Admin grant: same RPC, but stamped with the acting admin. Kept separate from
 * the contract's chargeCredits so the created_by column is only ever set by an
 * explicitly-admin code path.
 */
export async function grantCredits(
  db: SupabaseClient,
  input: { user_id: string; delta: number; reason: string; created_by: string },
): Promise<number> {
  const { data, error } = await db.rpc('ip_charge_credits', {
    p_user_id: input.user_id,
    p_delta: input.delta,
    p_reason: input.reason,
    p_generation_id: null,
    p_created_by: input.created_by,
  })
  if (error) throw error
  return Number(data)
}

/** Ledger totals per user across an owner scope — the admin cost dashboard. */
export async function listOwnerLedgerSince(
  db: SupabaseClient,
  ownerId: string,
  since: string,
): Promise<Pick<IpCreditLedgerEntry, 'user_id' | 'delta' | 'created_at'>[]> {
  const { data, error } = await db
    .from('ip_credit_ledger')
    .select('user_id, delta, created_at')
    .eq('owner_id', ownerId)
    .gte('created_at', since)
  if (error) throw error
  return (data ?? []).map((row) => {
    const r = row as { user_id: string; delta: number; created_at: string }
    return { user_id: r.user_id, delta: Number(r.delta), created_at: r.created_at }
  })
}

/** Balances for a set of users in one round trip (admin user list). */
export async function balancesFor(db: SupabaseClient, userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {}
  const { data, error } = await db
    .from('ip_credit_ledger')
    .select('user_id, delta')
    .in('user_id', userIds)
  if (error) throw error
  const totals: Record<string, number> = {}
  for (const row of data ?? []) {
    const r = row as { user_id: string; delta: number }
    totals[r.user_id] = (totals[r.user_id] ?? 0) + Number(r.delta)
  }
  for (const id of userIds) totals[id] = Math.round((totals[id] ?? 0) * 100) / 100
  return totals
}

function toLedgerEntry(row: unknown): IpCreditLedgerEntry {
  const r = row as IpCreditLedgerEntry
  return { ...r, delta: Number(r.delta) }
}

export const allocationRepository: AllocationRepository = {
  async getForUser(db, userId) {
    const { data, error } = await db
      .from('ip_credit_allocations')
      .select(ALLOCATION_SELECT)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? toAllocation(data) : null
  },

  async upsert(db, scope, input) {
    const { data, error } = await db
      .from('ip_credit_allocations')
      .upsert(
        {
          user_id: scope.user_id,
          owner_id: scope.owner_id,
          amount: input.amount,
          cadence: input.cadence,
          next_grant_at: input.next_grant_at,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select(ALLOCATION_SELECT)
      .single()
    if (error) throw error
    return toAllocation(data)
  },

  async listDue(db, now) {
    const { data, error } = await db
      .from('ip_credit_allocations')
      .select(ALLOCATION_SELECT)
      .lte('next_grant_at', now)
      .gt('amount', 0)
      .limit(500)
    if (error) throw error
    return (data ?? []).map(toAllocation)
  },

  async advanceNextGrant(db, id, nextGrantAt) {
    const { error } = await db
      .from('ip_credit_allocations')
      .update({ next_grant_at: nextGrantAt, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },
}

/** Every allocation in an owner scope (admin user list + cost dashboard). */
export async function listAllocationsForOwner(db: SupabaseClient, ownerId: string): Promise<IpCreditAllocation[]> {
  const { data, error } = await db
    .from('ip_credit_allocations')
    .select(ALLOCATION_SELECT)
    .eq('owner_id', ownerId)
  if (error) throw error
  return (data ?? []).map(toAllocation)
}

function toAllocation(row: unknown): IpCreditAllocation {
  const r = row as IpCreditAllocation
  return { ...r, amount: Number(r.amount) }
}

export const creditRequestRepository: CreditRequestRepository = {
  async create(db, scope, input) {
    const { data, error } = await db
      .from('ip_credit_requests')
      .insert({
        user_id: scope.user_id,
        owner_id: scope.owner_id,
        amount: input.amount,
        note: input.note,
      })
      .select(REQUEST_SELECT)
      .single()
    if (error) throw error
    return toRequest(data)
  },

  async listForOwner(db, ownerId, status) {
    let query = db
      .from('ip_credit_requests')
      .select(REQUEST_SELECT)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(toRequest)
  },

  async resolve(db, id, input) {
    // Guarded on 'pending' so a double-approve can't grant credits twice.
    const { data, error } = await db
      .from('ip_credit_requests')
      .update({ status: input.status, resolved_by: input.resolved_by, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select(REQUEST_SELECT)
      .single()
    if (error) throw error
    return toRequest(data)
  },
}

function toRequest(row: unknown): IpCreditRequest {
  const r = row as IpCreditRequest
  return { ...r, amount: Number(r.amount) }
}
