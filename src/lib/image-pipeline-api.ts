'use client'

import { apiFetch } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import type {
  AdminCostDashboardResponse,
  AdminUserRow,
  AllocationCadence,
  ChannelAvailability,
  CreditsSummaryResponse,
  GenerationChannel,
  ImagePipelineAdminContext,
  ImageTier,
  IpCreditRequest,
  IpGeneration,
  IpRateConfig,
  PromptPresetOption,
  RateKey,
  RetentionWeeks,
  TierResolution,
  UpsertPromptPresetRequest,
} from '@/types/image-pipeline'

/**
 * Client-side API for the Image Pipeline — the real counterpart to the Batch 1
 * mock facade, with the same function names and signatures so the hooks and
 * pages didn't have to change shape.
 *
 * A run's state lives on the server: the AI steps continue whether or not the
 * page is open, so `subscribeGeneration` is a *re-attach*, not a lifeline. It
 * uses Supabase Realtime with a slow poll behind it, so an update still lands
 * if the socket is unavailable.
 */

const BASE = '/api/v1/image-pipeline'

/* ── Context ──────────────────────────────────────────────────────────────── */

export interface PipelineContext {
  admin: ImagePipelineAdminContext
  tier: TierResolution
  skip_prompt_review: boolean
  retention_weeks: RetentionWeeks
  balance: number
  channels: ChannelAvailability[]
  /** Whatever run the user left in progress — used to resume, not restart. */
  active_generation: IpGeneration | null
}

export async function getContext(): Promise<PipelineContext> {
  return apiFetch<PipelineContext>(`${BASE}/context`)
}

export async function getChannelAvailability(): Promise<ChannelAvailability[]> {
  return (await getContext()).channels
}

export async function setRetentionWeeks(weeks: RetentionWeeks): Promise<void> {
  await apiFetch(`${BASE}/context`, { method: 'PATCH', body: JSON.stringify({ retention_weeks: weeks }) })
}

export async function setSkipPromptReview(skip: boolean): Promise<void> {
  await apiFetch(`${BASE}/context`, { method: 'PATCH', body: JSON.stringify({ skip_prompt_review: skip }) })
}

/* ── Generations ──────────────────────────────────────────────────────────── */

export interface StartGenerationInput {
  source_image_public_ids?: string[]
  source_image_urls?: string[]
  user_prompt?: string
  user_notes?: string
  prompt_preset?: string
  channel?: GenerationChannel
  retention_weeks?: RetentionWeeks
}

interface GenerationResult {
  generation: IpGeneration
  balance: number
}

export async function startGeneration(input: StartGenerationInput): Promise<IpGeneration> {
  const { generation } = await apiFetch<GenerationResult>(`${BASE}/generations`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return generation
}

/** Confirms the reviewed prompt — the first preview is already paid for. */
export async function confirmPrompt(id: string, finalPrompt: string): Promise<IpGeneration> {
  return submitPrompt(id, finalPrompt)
}

/** Edits the prompt after a preview exists — charges for the new preview. */
export async function editPrompt(id: string, finalPrompt: string): Promise<IpGeneration> {
  return submitPrompt(id, finalPrompt)
}

async function submitPrompt(id: string, finalPrompt: string): Promise<IpGeneration> {
  const { generation } = await apiFetch<GenerationResult>(`${BASE}/generations/${id}/prompt`, {
    method: 'PATCH',
    body: JSON.stringify({ final_prompt: finalPrompt }),
  })
  return generation
}

export async function approveGeneration(id: string): Promise<IpGeneration> {
  const { generation } = await apiFetch<GenerationResult>(`${BASE}/generations/${id}/approve`, { method: 'POST' })
  return generation
}

export async function rejectGeneration(id: string): Promise<IpGeneration> {
  const { generation } = await apiFetch<{ generation: IpGeneration }>(`${BASE}/generations/${id}/reject`, {
    method: 'POST',
  })
  return generation
}

/** Re-attempt a failed run from where it broke — reuses the existing prompt/preview. */
export async function retryGeneration(id: string): Promise<IpGeneration> {
  const { generation } = await apiFetch<GenerationResult>(`${BASE}/generations/${id}/retry`, { method: 'POST' })
  return generation
}

export async function getGeneration(id: string): Promise<IpGeneration | null> {
  try {
    const { generation } = await apiFetch<{ generation: IpGeneration }>(`${BASE}/generations/${id}`)
    return generation
  } catch {
    return null
  }
}

export async function listGenerations(): Promise<IpGeneration[]> {
  const { generations } = await apiFetch<{ generations: IpGeneration[] }>(`${BASE}/generations`)
  return generations
}

/** The run still in flight for this user, if any — how the page resumes. */
export async function getActiveGeneration(): Promise<IpGeneration | null> {
  const { generation } = await apiFetch<{ generation: IpGeneration | null }>(`${BASE}/generations?active=1`)
  return generation
}

/* ── Live updates ─────────────────────────────────────────────────────────── */

/** Statuses where the server still has work to do, so updates are still coming. */
const LIVE_STATUSES = new Set(['prompting', 'prompt_review', 'generating_preview', 'generating_final'])
const POLL_MS = 6000

/**
 * Follows one run's status transitions. Supabase Realtime is the fast path; a
 * slow poll runs alongside it so a dropped socket (or a browser that suspended
 * the tab in the background) still catches up rather than stalling on a
 * spinner. Returns an unsubscribe function.
 */
export function subscribeGeneration(id: string, onChange: (generation: IpGeneration) => void): () => void {
  let stopped = false

  const channel = supabase
    .channel(`ip_generation:${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'ip_generations', filter: `id=eq.${id}` },
      (payload) => {
        if (!stopped) onChange(payload.new as IpGeneration)
      },
    )
    .subscribe()

  // Backstop poll — cheap, and only while the server still owes us a change.
  const timer = setInterval(() => {
    void (async () => {
      const generation = await getGeneration(id)
      if (stopped || !generation) return
      onChange(generation)
      if (!LIVE_STATUSES.has(generation.status)) clearInterval(timer)
    })()
  }, POLL_MS)

  return () => {
    stopped = true
    clearInterval(timer)
    void supabase.removeChannel(channel)
  }
}

/* ── Credits ──────────────────────────────────────────────────────────────── */

export async function getCreditsSummary(): Promise<CreditsSummaryResponse> {
  return apiFetch<CreditsSummaryResponse>(`${BASE}/credits`)
}

export async function requestCredits(amount: number, note?: string): Promise<IpCreditRequest> {
  const { request } = await apiFetch<{ request: IpCreditRequest }>(`${BASE}/credits`, {
    method: 'POST',
    body: JSON.stringify({ amount, note }),
  })
  return request
}

/* ── Prompt presets ───────────────────────────────────────────────────────── */

export async function listPromptPresets(): Promise<PromptPresetOption[]> {
  const { presets } = await apiFetch<{ presets: PromptPresetOption[] }>(`${BASE}/presets`)
  return presets
}

export async function createPromptPreset(input: UpsertPromptPresetRequest): Promise<PromptPresetOption> {
  const { preset } = await apiFetch<{ preset: PromptPresetOption }>(`${BASE}/presets`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return preset
}

export async function updatePromptPreset(id: string, input: UpsertPromptPresetRequest): Promise<PromptPresetOption> {
  const { preset } = await apiFetch<{ preset: PromptPresetOption }>(`${BASE}/presets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return preset
}

export async function deletePromptPreset(id: string): Promise<void> {
  await apiFetch(`${BASE}/presets/${id}`, { method: 'DELETE' })
}

/* ── Admin ────────────────────────────────────────────────────────────────── */

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const { users } = await apiFetch<{ users: AdminUserRow[] }>(`${BASE}/admin/users`)
  return users
}

export async function adminSetTierOverride(userId: string, override: ImageTier | null): Promise<void> {
  await apiFetch(`${BASE}/admin/users`, {
    method: 'PATCH',
    body: JSON.stringify({ user_id: userId, image_tier_override: override }),
  })
}

export async function adminUpsertAllocation(
  userId: string,
  amount: number,
  cadence: AllocationCadence,
): Promise<void> {
  await apiFetch(`${BASE}/admin/allocations`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: userId, amount, cadence }),
  })
}

export async function adminManualGrant(userId: string, amount: number, note?: string): Promise<void> {
  await apiFetch(`${BASE}/admin/grants`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, amount, note }),
  })
}

export async function adminListRequests(): Promise<IpCreditRequest[]> {
  const { requests } = await apiFetch<{ requests: IpCreditRequest[] }>(`${BASE}/admin/requests`)
  return requests
}

export async function adminResolveRequest(requestId: string, decision: 'approved' | 'denied'): Promise<void> {
  await apiFetch(`${BASE}/admin/requests`, {
    method: 'PATCH',
    body: JSON.stringify({ request_id: requestId, decision }),
  })
}

export async function adminGetRates(): Promise<IpRateConfig[]> {
  const { rates } = await apiFetch<{ rates: IpRateConfig[] }>(`${BASE}/admin/rates`)
  return rates
}

export async function adminUpdateRate(key: RateKey, value: number): Promise<IpRateConfig> {
  const { rates } = await apiFetch<{ rates: IpRateConfig[] }>(`${BASE}/admin/rates`, {
    method: 'PATCH',
    body: JSON.stringify({ rates: { [key]: value } }),
  })
  const updated = rates.find((rate) => rate.key === key)
  if (!updated) throw new Error('That rate couldn’t be saved. Please try again.')
  return updated
}

export async function adminCostDashboard(period: 'week' | 'month'): Promise<AdminCostDashboardResponse> {
  return apiFetch<AdminCostDashboardResponse>(`${BASE}/admin/costs?period=${period}`)
}

/**
 * The API already returns plain-English messages in its error envelope and
 * apiFetch rethrows them, so this just guards against a non-Error throw.
 */
export function pipelineErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Something needs another try — please retry.'
}
