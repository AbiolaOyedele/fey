import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { userSettingsRepository as settingsRepo } from '@/repositories/image-pipeline/settings.repository'
import {
  DEFAULT_RETENTION_WEEKS,
  type ChannelAvailability,
  type ImagePipelineAdminContext,
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
  /** The run still in flight for this user, if any. */
  active_generation: IpGeneration | null
}

export async function getPipelineContext(db: SupabaseClient, ctx: PipelineCtx): Promise<PipelineContextResponse> {
  const [settings, tier, balance, channels, active] = await Promise.all([
    settingsRepo.getForUser(db, ctx.userId),
    resolveTier(db, ctx),
    getBalance(db, ctx.userId),
    getChannelAvailability(db),
    getActiveGeneration(db, ctx.userId),
  ])

  return {
    admin: resolveAdminContext(ctx),
    tier,
    skip_prompt_review: settings?.skip_prompt_review ?? false,
    retention_weeks: settings?.retention_weeks ?? DEFAULT_RETENTION_WEEKS,
    balance,
    channels,
    active_generation: active,
  }
}

const settingsSchema = z.object({
  retention_weeks: z.union([z.literal(1), z.literal(2)]).optional(),
  skip_prompt_review: z.boolean().optional(),
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
}
