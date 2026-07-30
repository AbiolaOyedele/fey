import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { generateImagePrompt } from '@/lib/anthropic'
import { renderImage, type RenderSize } from '@/lib/gemini'
import { destroyCloudinaryAssetById, uploadCloudinaryAsset } from '@/lib/cloudinary-server'
import { generationRepository as generations } from '@/repositories/image-pipeline/generation.repository'
import { flowRepository as flow, userSettingsRepository as settingsRepo } from '@/repositories/image-pipeline/settings.repository'
import {
  CREDIT_COST,
  DEFAULT_RETENTION_WEEKS,
  GENERATION_CHANNELS,
  IN_FLIGHT_STATUSES,
  MAX_IN_FLIGHT_PER_USER,
  RETENTION_WEEK_OPTIONS,
  type ChannelAvailability,
  type ImageTier,
  type IpGeneration,
  type RetentionWeeks,
} from '@/types/image-pipeline'
import { assertCanAfford, chargeStep, getBalance, refundStep } from './credits.service'
import { resolveTier, type PipelineCtx } from './tier.service'

/**
 * The Image Pipeline state machine:
 *
 *   prompting → prompt_review → generating_preview → preview_ready
 *                    ↘ (skip_prompt_review) ↗              ↓ approve
 *                                                   generating_final → complete
 *
 * Two gates. Gate 1 (prompt review) is a per-user preference — when skipped the
 * prompt is still stored and editable. Gate 2 (approve the 1K preview before
 * the 2K final) is never skippable: it is what stops a bad prompt spending the
 * expensive half of a credit.
 *
 * The AI calls run *after* the response is sent (see BackgroundRunner) and each
 * status transition is written to the row, which the client follows over
 * Supabase Realtime. Every charged step that then fails is refunded.
 */

/** Defers work until after the response — the route passes Next's `after`. */
export type BackgroundRunner = (task: () => Promise<void>) => void

/** A worker is considered offline 90s after its last heartbeat. */
const WORKER_STALE_MS = 90_000

const createSchema = z.object({
  source_image_public_id: z.string().max(300).optional(),
  source_image_url: z
    .string()
    .url()
    .startsWith('https://res.cloudinary.com/', 'That reference image isn’t valid.')
    .optional(),
  user_prompt: z.string().trim().max(4000).optional(),
  user_notes: z.string().trim().max(2000).optional(),
  channel: z.enum(GENERATION_CHANNELS).optional(),
  retention_weeks: z.union([z.literal(1), z.literal(2)]).optional(),
  workspace_id: z.string().uuid().optional(),
})

const promptSchema = z.object({
  final_prompt: z.string().trim().min(1, 'Add a prompt before generating.').max(6000),
})

/* ── Channels ─────────────────────────────────────────────────────────────── */

export async function getChannelAvailability(db: SupabaseClient): Promise<ChannelAvailability[]> {
  const online = await isFlowWorkerOnline(db)
  return [
    { channel: 'api', online: true },
    online
      ? { channel: 'flow', online: true }
      : { channel: 'flow', online: false, reason: 'No desktop worker online' },
  ]
}

async function isFlowWorkerOnline(db: SupabaseClient): Promise<boolean> {
  try {
    const heartbeats = await flow.getHeartbeats(db)
    const cutoff = Date.now() - WORKER_STALE_MS
    return heartbeats.some((hb) => new Date(hb.last_seen).getTime() > cutoff)
  } catch {
    return false // never let a heartbeat lookup break the page
  }
}

/* ── Reads ────────────────────────────────────────────────────────────────── */

export async function listGenerations(db: SupabaseClient, userId: string): Promise<IpGeneration[]> {
  return generations.listForUser(db, userId)
}

/**
 * The run the user is currently in the middle of, if any.
 *
 * The pipeline's state lives in the database and the AI steps run server-side,
 * so leaving the page never cancels a run — this is what lets the Generate page
 * pick the run back up when the user returns instead of losing their progress
 * (and the credits already spent on it).
 */
export async function getActiveGeneration(db: SupabaseClient, userId: string): Promise<IpGeneration | null> {
  const all = await generations.listForUser(db, userId)
  return all.find((g) => (IN_FLIGHT_STATUSES as readonly string[]).includes(g.status)) ?? null
}

export async function getGeneration(db: SupabaseClient, ctx: PipelineCtx, id: string): Promise<IpGeneration> {
  const generation = await generations.getById(db, id)
  if (!generation) throw notFound()
  // RLS already scopes this; the explicit check is defence in depth.
  if (generation.user_id !== ctx.userId) throw notFound()
  return generation
}

const notFound = () => new AppError(404, 'That generation could not be found.', 'IP_GENERATION_NOT_FOUND')

function assertStatus(generation: IpGeneration, allowed: IpGeneration['status'][]): void {
  if (!allowed.includes(generation.status)) {
    throw new AppError(409, 'That generation has already moved on. Refresh and try again.', 'IP_GENERATION_WRONG_STATE')
  }
}

/* ── Start a run ──────────────────────────────────────────────────────────── */

export async function startGeneration(
  db: SupabaseClient,
  ctx: PipelineCtx,
  input: unknown,
  background: BackgroundRunner,
): Promise<{ generation: IpGeneration; balance: number }> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That request isn’t valid.', 'IP_GENERATION_INVALID')
  }
  const d = parsed.data

  const hasImage = !!d.source_image_url
  const hasPrompt = !!d.user_prompt?.trim()
  if (!hasImage && !hasPrompt) {
    throw new AppError(400, 'Add a reference image or a prompt to start a generation.', 'IP_GENERATION_NO_INPUT')
  }

  const channel = d.channel ?? 'api'
  if (channel === 'flow' && !(await isFlowWorkerOnline(db))) {
    throw new AppError(
      409,
      'The Flow desktop channel is offline right now. Use the API channel instead.',
      'IP_FLOW_WORKER_OFFLINE',
    )
  }
  if (channel === 'flow') {
    // The worker package lands in Step 14; until then the channel can't run a job.
    throw new AppError(501, 'The Flow desktop channel isn’t available yet.', 'IP_FLOW_NOT_IMPLEMENTED')
  }

  const inFlight = await generations.countInFlight(db, ctx.userId)
  if (inFlight >= MAX_IN_FLIGHT_PER_USER) {
    throw new AppError(
      409,
      `You already have ${MAX_IN_FLIGHT_PER_USER} generations in progress. Finish or reject one first.`,
      'IP_TOO_MANY_IN_FLIGHT',
    )
  }

  await assertCanAfford(db, ctx.userId, CREDIT_COST.preview)

  const { tier } = await resolveTier(db, ctx)
  const settings = await settingsRepo.getForUser(db, ctx.userId)
  const retention: RetentionWeeks = d.retention_weeks ?? settings?.retention_weeks ?? DEFAULT_RETENTION_WEEKS
  if (!(RETENTION_WEEK_OPTIONS as readonly number[]).includes(retention)) {
    throw new AppError(400, 'Pick a retention period of 1 or 2 weeks.', 'IP_GENERATION_INVALID')
  }

  const generation = await generations.create(
    db,
    { user_id: ctx.userId, owner_id: ctx.ownerId },
    {
      channel,
      tier,
      source_image_public_id: d.source_image_public_id ?? null,
      source_image_url: d.source_image_url ?? null,
      user_prompt: d.user_prompt?.trim() ? d.user_prompt.trim() : null,
      user_notes: d.user_notes?.trim() ? d.user_notes.trim() : null,
      retention_weeks: retention,
    },
  )

  let balance: number
  try {
    balance = await chargeStep(db, {
      userId: ctx.userId,
      amount: CREDIT_COST.preview,
      reason: 'preview_charge',
      generationId: generation.id,
    })
  } catch (err) {
    // Lost a race for the last credits — retire the row rather than leave it
    // sitting in-flight against the abuse guard.
    await generations
      .update(db, generation.id, { status: 'failed', error_message: 'Not enough credits.' })
      .catch(() => undefined)
    throw err
  }

  const skipReview = settings?.skip_prompt_review ?? false
  background(() => runPromptStep(db, ctx, generation, skipReview))

  return { generation, balance }
}

/* ── Gate 1: the prompt ───────────────────────────────────────────────────── */

/** Confirm the reviewed prompt and render the FIRST preview — already paid for. */
export async function confirmPrompt(
  db: SupabaseClient,
  ctx: PipelineCtx,
  id: string,
  input: unknown,
  background: BackgroundRunner,
): Promise<{ generation: IpGeneration; balance: number }> {
  const generation = await getGeneration(db, ctx, id)
  assertStatus(generation, ['prompt_review'])
  const prompt = parsePrompt(input)

  const updated = await generations.update(db, id, { status: 'generating_preview', final_prompt: prompt })
  background(() => runPreviewStep(db, ctx, updated, prompt))
  return { generation: updated, balance: await getBalance(db, ctx.userId) }
}

/** Edit the prompt after a preview exists — a fresh preview, so a fresh charge. */
export async function editPrompt(
  db: SupabaseClient,
  ctx: PipelineCtx,
  id: string,
  input: unknown,
  background: BackgroundRunner,
): Promise<{ generation: IpGeneration; balance: number }> {
  const generation = await getGeneration(db, ctx, id)
  assertStatus(generation, ['preview_ready', 'failed'])
  const prompt = parsePrompt(input)

  const balance = await chargeStep(db, {
    userId: ctx.userId,
    amount: CREDIT_COST.preview,
    reason: 'preview_charge',
    generationId: id,
  })

  // The superseded preview is unreferenced from here on — drop the asset.
  const stalePreviewId = generation.preview_public_id
  const updated = await generations.update(db, id, {
    status: 'generating_preview',
    final_prompt: prompt,
    preview_url: null,
    preview_public_id: null,
    error_message: null,
  })

  background(async () => {
    if (stalePreviewId) await destroyCloudinaryAssetById(stalePreviewId, 'image')
    await runPreviewStep(db, ctx, updated, prompt)
  })
  return { generation: updated, balance }
}

/**
 * One entry point for both prompt gates: confirming the reviewed prompt (free —
 * the first preview is covered by the start charge) and editing it after a
 * preview exists (a new preview, so a new charge). Which one applies is decided
 * by the run's current status, never by the client.
 */
export async function submitPrompt(
  db: SupabaseClient,
  ctx: PipelineCtx,
  id: string,
  input: unknown,
  background: BackgroundRunner,
): Promise<{ generation: IpGeneration; balance: number }> {
  const generation = await getGeneration(db, ctx, id)
  return generation.status === 'prompt_review'
    ? confirmPrompt(db, ctx, id, input, background)
    : editPrompt(db, ctx, id, input, background)
}

function parsePrompt(input: unknown): string {
  const parsed = promptSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That prompt isn’t valid.', 'IP_PROMPT_INVALID')
  }
  return parsed.data.final_prompt
}

/* ── Gate 2: the preview ──────────────────────────────────────────────────── */

/** Approve the 1K preview → charge the final → render at 2K. Never skippable. */
export async function approveGeneration(
  db: SupabaseClient,
  ctx: PipelineCtx,
  id: string,
  background: BackgroundRunner,
): Promise<{ generation: IpGeneration; balance: number }> {
  const generation = await getGeneration(db, ctx, id)
  // A 2K render is only ever reachable from an approved preview.
  assertStatus(generation, ['preview_ready'])
  if (!generation.final_prompt) {
    throw new AppError(409, 'That generation has no prompt to render. Edit the prompt and try again.', 'IP_GENERATION_WRONG_STATE')
  }

  const balance = await chargeStep(db, {
    userId: ctx.userId,
    amount: CREDIT_COST.final,
    reason: 'final_charge',
    generationId: id,
  })

  const updated = await generations.update(db, id, { status: 'generating_final' })
  background(() => runFinalStep(db, ctx, updated))
  return { generation: updated, balance }
}

/**
 * Reject the preview. No further charge — the 0.25 for the preview is spent.
 * The image is kept until the run's retention deadline, like any other.
 */
export async function rejectGeneration(db: SupabaseClient, ctx: PipelineCtx, id: string): Promise<IpGeneration> {
  const generation = await getGeneration(db, ctx, id)
  assertStatus(generation, ['preview_ready'])
  return generations.update(db, id, { status: 'rejected' })
}

/* ── Background steps ─────────────────────────────────────────────────────── */

async function runPromptStep(
  db: SupabaseClient,
  ctx: PipelineCtx,
  generation: IpGeneration,
  skipReview: boolean,
): Promise<void> {
  let prompt: string
  try {
    prompt = await generateImagePrompt({
      tier: generation.tier,
      sourceImageUrl: generation.source_image_url,
      userPrompt: generation.user_prompt,
      userNotes: generation.user_notes,
    })
  } catch (err) {
    await failRun(db, ctx, generation.id, err, CREDIT_COST.preview)
    return
  }

  if (!skipReview) {
    await generations.update(db, generation.id, { status: 'prompt_review', generated_prompt: prompt })
    return
  }

  // Gate 1 skipped: straight to the preview. The prompt is still stored and
  // stays editable from the UI.
  const updated = await generations.update(db, generation.id, {
    status: 'generating_preview',
    generated_prompt: prompt,
    final_prompt: prompt,
  })
  await runPreviewStep(db, ctx, updated, prompt)
}

async function runPreviewStep(
  db: SupabaseClient,
  ctx: PipelineCtx,
  generation: IpGeneration,
  prompt: string,
): Promise<void> {
  try {
    const asset = await renderAndStore(generation, prompt, '1K', 'preview')
    await generations.update(db, generation.id, {
      status: 'preview_ready',
      preview_url: asset.url,
      preview_public_id: asset.publicId,
      error_message: null,
    })
  } catch (err) {
    await failRun(db, ctx, generation.id, err, CREDIT_COST.preview)
  }
}

async function runFinalStep(db: SupabaseClient, ctx: PipelineCtx, generation: IpGeneration): Promise<void> {
  try {
    const asset = await renderAndStore(generation, generation.final_prompt ?? '', '2K', 'final')
    await generations.update(db, generation.id, {
      status: 'complete',
      final_url: asset.url,
      final_public_id: asset.publicId,
      error_message: null,
    })
  } catch (err) {
    await failRun(db, ctx, generation.id, err, CREDIT_COST.final)
  }
}

/** Renders one image and stores it server-side. Cloudinary secrets stay here. */
async function renderAndStore(
  generation: IpGeneration,
  prompt: string,
  size: RenderSize,
  kind: 'preview' | 'final',
): Promise<{ url: string; publicId: string }> {
  const rendered = await renderImage({
    tier: generation.tier as ImageTier,
    prompt,
    sourceImageUrl: generation.source_image_url,
    size,
  })

  // public_id is derived server-side — never from a user-supplied filename.
  const uploaded = await uploadCloudinaryAsset(rendered.data, {
    folder: `image-pipeline/${generation.user_id}/${generation.id}`,
    publicId: `${kind}-${crypto.randomUUID().slice(0, 8)}`,
    mimeType: rendered.mimeType,
  })
  if (!uploaded) {
    throw new AppError(502, 'The image was generated but couldn’t be saved. Please try again.', 'IP_UPLOAD_FAILED')
  }
  return { url: uploaded.url, publicId: uploaded.publicId }
}

/**
 * Marks a run failed and refunds the step that was already charged, so a
 * provider outage never costs the user credits.
 */
async function failRun(
  db: SupabaseClient,
  ctx: PipelineCtx,
  generationId: string,
  err: unknown,
  refundAmount: number,
): Promise<void> {
  const message =
    err instanceof AppError ? err.message : 'Something went wrong generating that image. Please try again.'
  console.error('[image-pipeline] run failed', {
    generationId,
    code: err instanceof AppError ? err.code : 'IP_UNKNOWN',
  })
  await refundStep(db, { userId: ctx.userId, amount: refundAmount, generationId })
  await generations
    .update(db, generationId, { status: 'failed', error_message: message })
    .catch((updateErr) => console.error('[image-pipeline] could not mark run failed', { generationId, name: (updateErr as Error)?.name }))
}
