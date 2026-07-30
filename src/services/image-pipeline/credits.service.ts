import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import {
  allocationRepository as allocations,
  creditRepository as credits,
  creditRequestRepository as requests,
} from '@/repositories/image-pipeline/credit.repository'
import {
  CREDIT_COST,
  CREDITS_PER_RUN,
  type CreditsSummaryResponse,
  type IpCreditRequest,
  type LedgerReason,
} from '@/types/image-pipeline'
import type { PipelineCtx } from './tier.service'

/**
 * Credit business logic. Every delta goes through the ip_charge_credits
 * SECURITY DEFINER function (via the repository) — there is no balance
 * arithmetic in application code, and no other write path to the ledger.
 */

/** Thrown by the RPC when a charge would take the balance below zero. */
const INSUFFICIENT = 'INSUFFICIENT_CREDITS'

export function insufficientCreditsError(): AppError {
  return new AppError(
    402,
    'You don’t have enough credits for this step. Request more from the Credits page.',
    'IP_INSUFFICIENT_CREDITS',
  )
}

/** Charges a pipeline step. Translates the RPC's guard into an AppError. */
export async function chargeStep(
  db: SupabaseClient,
  input: { userId: string; amount: number; reason: LedgerReason; generationId: string | null },
): Promise<number> {
  try {
    return await credits.chargeCredits(db, {
      user_id: input.userId,
      delta: -Math.abs(input.amount),
      reason: input.reason,
      generation_id: input.generationId,
    })
  } catch (err) {
    if (err instanceof Error && err.message === INSUFFICIENT) throw insufficientCreditsError()
    throw err
  }
}

/**
 * Puts a charged step back when the AI call fails afterwards. Best-effort: the
 * refund must never mask the original failure, so it only logs on error.
 */
export async function refundStep(
  db: SupabaseClient,
  input: { userId: string; amount: number; generationId: string },
): Promise<void> {
  try {
    await credits.chargeCredits(db, {
      user_id: input.userId,
      delta: Math.abs(input.amount),
      reason: 'adjustment',
      generation_id: input.generationId,
    })
  } catch (err) {
    console.error('[refundStep] refund failed', {
      generationId: input.generationId,
      name: (err as Error)?.name,
    })
  }
}

/** Cheap pre-check so a run isn't created that can't be paid for. */
export async function assertCanAfford(db: SupabaseClient, userId: string, amount: number): Promise<void> {
  const balance = await credits.getBalance(db, userId)
  if (balance < amount) throw insufficientCreditsError()
}

export async function getCreditsSummary(db: SupabaseClient, userId: string): Promise<CreditsSummaryResponse> {
  const [balance, ledger, allocation] = await Promise.all([
    credits.getBalance(db, userId),
    credits.listLedger(db, userId),
    allocations.getForUser(db, userId),
  ])
  return {
    balance: { balance, cost_per_run: CREDITS_PER_RUN },
    ledger,
    allocation,
  }
}

export async function getBalance(db: SupabaseClient, userId: string): Promise<number> {
  return credits.getBalance(db, userId)
}

const requestSchema = z.object({
  amount: z
    .number({ message: 'Enter how many credits you need.' })
    .positive('Ask for at least a fraction of a credit.')
    .max(1000, 'That’s more credits than can be requested at once.'),
  note: z.string().trim().max(500).optional(),
})

export async function createCreditRequest(
  db: SupabaseClient,
  ctx: PipelineCtx,
  input: unknown,
): Promise<IpCreditRequest> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That request isn’t valid.', 'IP_CREDIT_REQUEST_INVALID')
  }
  const { amount, note } = parsed.data
  return requests.create(
    db,
    { user_id: ctx.userId, owner_id: ctx.ownerId },
    { amount: Math.round(amount * 100) / 100, note: note?.trim() ? note.trim() : null },
  )
}

export { CREDIT_COST }
