import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { userSettingsRepository as settingsRepo } from '@/repositories/image-pipeline/settings.repository'
import { isProviderConfigured } from '@/lib/image-render'
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_RETENTION_WEEKS,
  findImageModel,
  imageModelsForTier,
  type ChannelAvailability,
  type ImageModelMeta,
  type ImagePipelineAdminContext,
  type ImageTier,
  type IpGeneration,
  type RetentionWeeks,
  type TierResolution,
} from '@/types/image-pipeline'
import { getBalance } from './credits.service'
import { getActiveGeneration, getChannelAvailability } from './generation.service'
import { resolveAdminContext, resolveTier, type PipelineCtx } from './tier.service'

/**
 * Everything the Image Pipeline corner needs on load: who the user is to this
 * module (admin flags, resolved tier), their preferences, their balance, which
 * channels are available, and — crucially — whichever run they left in
 * progress, so returning to the page resumes it rather than losing it.
 */
export interface PipelineContextResponse {
  admin: ImagePipelineAdminContext
  tier: TierResolution
  skip_prompt_review: boolean
  retention_weeks: RetentionWeeks
  balance: number
  channels: ChannelAvailability[]
  /**
   * Render engines this caller may actually pick — filtered by their tier AND
   * by which providers have a key configured. Resolved server-side so the
   * picker can't offer a model the server would refuse.
   */
  models: ImageModelMeta[]
  /** Pre-selected model: the user's saved preference, else the app default. */
  default_image_model: string
  /** The run still in flight for this user, if any. */
  active_generation: IpGeneration | null
}

/**
 * The models on offer, and which one starts selected.
 *
 * A saved preference that no longer qualifies — the model left the catalogue,
 * the user's tier was lowered, or its provider lost its key — falls back to the
 * first available model rather than being offered and then refused on submit.
 */
function resolveModelChoice(tier: ImageTier, saved: string | null): { models: ImageModelMeta[]; selected: string } {
  const models = imageModelsForTier(tier).filter((m) => isProviderConfigured(m.provider))
  const preferred = saved && models.some((m) => m.id === saved) ? saved : null
  const appDefault = models.some((m) => m.id === DEFAULT_IMAGE_MODEL) ? DEFAULT_IMAGE_MODEL : null
  return { models, selected: preferred ?? appDefault ?? models[0]?.id ?? DEFAULT_IMAGE_MODEL }
}

export async function getPipelineContext(db: SupabaseClient, ctx: PipelineCtx): Promise<PipelineContextResponse> {
  const [settings, tier, balance, channels, active] = await Promise.all([
    settingsRepo.getForUser(db, ctx.userId),
    resolveTier(db, ctx),
    getBalance(db, ctx.userId),
    getChannelAvailability(db),
    getActiveGeneration(db, ctx.userId),
  ])

  const { models, selected } = resolveModelChoice(tier.tier, settings?.default_image_model ?? null)

  return {
    admin: resolveAdminContext(ctx),
    tier,
    skip_prompt_review: settings?.skip_prompt_review ?? false,
    retention_weeks: settings?.retention_weeks ?? DEFAULT_RETENTION_WEEKS,
    balance,
    channels,
    models,
    default_image_model: selected,
    active_generation: active,
  }
}

const settingsSchema = z.object({
  retention_weeks: z.union([z.literal(1), z.literal(2)]).optional(),
  skip_prompt_review: z.boolean().optional(),
  /** null clears the saved model preference. */
  default_image_model: z.string().trim().max(64).nullable().optional(),
})

/** Updates the caller's own pipeline preferences (never someone else's). */
export async function updateOwnSettings(db: SupabaseClient, ctx: PipelineCtx, input: unknown): Promise<void> {
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, 'That setting isn’t valid.', 'IP_SETTINGS_INVALID')
  const scope = { user_id: ctx.userId, owner_id: ctx.ownerId }

  if (parsed.data.retention_weeks !== undefined) {
    await settingsRepo.setRetentionWeeks(db, scope, parsed.data.retention_weeks)
  }
  if (parsed.data.skip_prompt_review !== undefined) {
    await settingsRepo.setSkipPromptReview(db, scope, parsed.data.skip_prompt_review)
  }
  if (parsed.data.default_image_model !== undefined) {
    await settingsRepo.setDefaultImageModel(db, scope, await validModelPreference(db, ctx, parsed.data.default_image_model))
  }
}

/**
 * Validates a saved model preference before it is stored.
 *
 * Storing a model the user isn't entitled to would sit there quietly until the
 * next run, which would then be refused with no obvious cause — so the same
 * tier and provider-configuration rules that gate a run apply here too.
 */
async function validModelPreference(db: SupabaseClient, ctx: PipelineCtx, model: string | null): Promise<string | null> {
  if (!model) return null
  const meta = findImageModel(model)
  if (!meta) throw new AppError(400, 'That image model isn’t available. Pick one from the list.', 'IP_MODEL_UNKNOWN')
  if (!isProviderConfigured(meta.provider)) {
    throw new AppError(503, `${meta.label} isn’t set up yet. Pick another model.`, 'IP_MODEL_NOT_CONFIGURED')
  }
  const { tier } = await resolveTier(db, ctx)
  if (!meta.tiers.includes(tier)) {
    throw new AppError(403, `${meta.label} is only available on the pro tier.`, 'IP_MODEL_TIER_FORBIDDEN')
  }
  return meta.id
}
