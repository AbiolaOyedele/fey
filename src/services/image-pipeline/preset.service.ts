import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { presetRepository as presets } from '@/repositories/image-pipeline/preset.repository'
import { builtinSystemPrompt, defaultSystemPrompt } from '@/lib/image-pipeline-presets'
import {
  BUILTIN_PROMPT_PRESETS,
  DEFAULT_PROMPT_PRESET_KEY,
  PRESET_LIMITS,
  type IpPromptPreset,
  type PromptPresetOption,
} from '@/types/image-pipeline'
import type { PipelineCtx } from './tier.service'

/**
 * Prompt-preset business logic: the list a user picks from (built-ins + the
 * workspace's own), CRUD for custom presets, and resolving a stored preset key
 * to the system prompt used for the prompt-writing step.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toOption(preset: IpPromptPreset): PromptPresetOption {
  return {
    key: preset.id,
    label: preset.name,
    description: preset.description,
    builtin: false,
    system_prompt: preset.system_prompt,
    created_by: preset.user_id,
  }
}

const builtinOptions: PromptPresetOption[] = BUILTIN_PROMPT_PRESETS.map((p) => ({
  key: p.key,
  label: p.label,
  description: p.description,
  builtin: true,
}))

/** Built-ins first (Default leads), then the workspace's own presets, newest first. */
export async function listPresets(db: SupabaseClient, ctx: PipelineCtx): Promise<PromptPresetOption[]> {
  const custom = await presets.listForOwner(db, ctx.ownerId)
  return [...builtinOptions, ...custom.map(toOption)]
}

const upsertSchema = z.object({
  name: z.string().trim().min(1, 'Give the preset a name.').max(PRESET_LIMITS.name),
  description: z.string().trim().max(PRESET_LIMITS.description).optional(),
  system_prompt: z
    .string()
    .trim()
    .min(1, 'Add the preset’s instructions.')
    .max(PRESET_LIMITS.systemPrompt, 'That preset is too long.'),
})

export async function createPreset(db: SupabaseClient, ctx: PipelineCtx, input: unknown): Promise<PromptPresetOption> {
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That preset isn’t valid.', 'IP_PRESET_INVALID')
  }
  const created = await presets.create(
    db,
    { user_id: ctx.userId, owner_id: ctx.ownerId },
    {
      name: parsed.data.name,
      description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
      system_prompt: parsed.data.system_prompt,
    },
  )
  return toOption(created)
}

export async function updatePreset(
  db: SupabaseClient,
  _ctx: PipelineCtx,
  id: string,
  input: unknown,
): Promise<PromptPresetOption> {
  if (!UUID_RE.test(id)) throw new AppError(400, 'That preset isn’t valid.', 'IP_PRESET_INVALID')
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That preset isn’t valid.', 'IP_PRESET_INVALID')
  }
  // RLS enforces who may edit; a mismatched row simply won't update.
  const existing = await presets.getById(db, id)
  if (!existing) throw new AppError(404, 'That preset could not be found.', 'IP_PRESET_NOT_FOUND')
  const updated = await presets.update(db, id, {
    name: parsed.data.name,
    description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
    system_prompt: parsed.data.system_prompt,
  })
  return toOption(updated)
}

export async function deletePreset(db: SupabaseClient, _ctx: PipelineCtx, id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new AppError(400, 'That preset isn’t valid.', 'IP_PRESET_INVALID')
  await presets.remove(db, id)
}

/**
 * Resolves a stored preset key to the system prompt for the prompt step:
 *   • a built-in key ('default', …) → its code-defined prompt,
 *   • a custom preset UUID → that row's system_prompt (must be in this scope),
 *   • anything unresolved → the Default prompt, so a run never fails on a
 *     deleted or unknown preset.
 */
export async function resolveSystemPrompt(db: SupabaseClient, presetKey: string, ownerId: string): Promise<string> {
  const builtin = builtinSystemPrompt(presetKey)
  if (builtin) return builtin

  if (UUID_RE.test(presetKey)) {
    try {
      const custom = await presets.getById(db, presetKey)
      if (custom && custom.owner_id === ownerId) return custom.system_prompt
    } catch {
      /* fall through to the default */
    }
  }
  return defaultSystemPrompt()
}

/** True when a preset key is usable — a built-in, or a UUID that may be a custom preset. */
export function isKnownPresetShape(presetKey: string): boolean {
  return presetKey === DEFAULT_PROMPT_PRESET_KEY || builtinSystemPrompt(presetKey) !== null || UUID_RE.test(presetKey)
}
