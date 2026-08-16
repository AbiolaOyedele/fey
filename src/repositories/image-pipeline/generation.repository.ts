import type { SupabaseClient } from '@supabase/supabase-js'
import {
  IN_FLIGHT_STATUSES,
  type GenerationRepository,
  type IpGeneration,
} from '@/types/image-pipeline'

/**
 * Queries for ip_generations. Callers pass a user-scoped client so RLS decides
 * what is visible (own runs, plus the whole scope for a workspace admin).
 * Queries only — no business logic, no charging.
 */

const SELECT = `
  id, user_id, owner_id, channel, tier, image_model, status,
  source_image_public_ids, source_image_urls, send_reference_to_image_model,
  user_prompt, user_notes, prompt_preset,
  generated_prompt, final_prompt,
  preview_public_id, preview_url, final_public_id, final_url,
  error_message, created_at, updated_at, expires_at
`

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const generationRepository: GenerationRepository = {
  async create(db, scope, input) {
    const expiresAt = new Date(Date.now() + input.retention_weeks * WEEK_MS).toISOString()
    const { data, error } = await db
      .from('ip_generations')
      .insert({
        user_id: scope.user_id,
        owner_id: scope.owner_id,
        channel: input.channel,
        tier: input.tier,
        image_model: input.image_model,
        status: 'prompting',
        source_image_public_ids: input.source_image_public_ids,
        source_image_urls: input.source_image_urls,
        send_reference_to_image_model: input.send_reference_to_image_model,
        user_prompt: input.user_prompt,
        user_notes: input.user_notes,
        prompt_preset: input.prompt_preset,
        expires_at: expiresAt,
      })
      .select(SELECT)
      .single()
    if (error) throw error
    return data as IpGeneration
  },

  async getById(db, id) {
    const { data, error } = await db.from('ip_generations').select(SELECT).eq('id', id).maybeSingle()
    if (error) throw error
    return (data as IpGeneration | null) ?? null
  },

  async listForUser(db, userId) {
    const { data, error } = await db
      .from('ip_generations')
      .select(SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as IpGeneration[]
  },

  async update(db, id, patch) {
    const { data, error } = await db
      .from('ip_generations')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) throw error
    return data as IpGeneration
  },

  async countInFlight(db, userId) {
    const { count, error } = await db
      .from('ip_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', IN_FLIGHT_STATUSES as unknown as string[])
    if (error) throw error
    return count ?? 0
  },
}

/** Runs past their retention deadline — the daily cleanup sweep (service role). */
export async function listExpired(db: SupabaseClient, now: string, limit = 200): Promise<IpGeneration[]> {
  const { data, error } = await db
    .from('ip_generations')
    .select(SELECT)
    .lt('expires_at', now)
    .not('status', 'in', '("expired","failed")')
    .limit(limit)
  if (error) throw error
  return (data ?? []) as IpGeneration[]
}

/** Every generation in an owner scope within a window — the admin cost dashboard. */
export async function listForOwnerSince(
  db: SupabaseClient,
  ownerId: string,
  since: string,
): Promise<Pick<IpGeneration, 'id' | 'user_id' | 'tier' | 'status' | 'created_at'>[]> {
  const { data, error } = await db
    .from('ip_generations')
    .select('id, user_id, tier, status, created_at')
    .eq('owner_id', ownerId)
    .gte('created_at', since)
  if (error) throw error
  return (data ?? []) as Pick<IpGeneration, 'id' | 'user_id' | 'tier' | 'status' | 'created_at'>[]
}
