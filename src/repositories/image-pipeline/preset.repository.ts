import type { SupabaseClient } from '@supabase/supabase-js'
import type { IpPromptPreset } from '@/types/image-pipeline'

/**
 * Queries for ip_prompt_presets (workspace-authored prompt presets). Callers
 * pass a user-scoped client so RLS decides visibility (any member of the scope
 * can read + use; the creator or a workspace admin can edit/delete). Queries
 * only — no business logic.
 */

const SELECT = 'id, owner_id, user_id, name, description, system_prompt, created_at, updated_at'

export const presetRepository = {
  async listForOwner(db: SupabaseClient, ownerId: string): Promise<IpPromptPreset[]> {
    const { data, error } = await db
      .from('ip_prompt_presets')
      .select(SELECT)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as IpPromptPreset[]
  },

  async getById(db: SupabaseClient, id: string): Promise<IpPromptPreset | null> {
    const { data, error } = await db.from('ip_prompt_presets').select(SELECT).eq('id', id).maybeSingle()
    if (error) throw error
    return (data as IpPromptPreset | null) ?? null
  },

  async create(
    db: SupabaseClient,
    scope: { user_id: string; owner_id: string },
    input: { name: string; description: string | null; system_prompt: string },
  ): Promise<IpPromptPreset> {
    const { data, error } = await db
      .from('ip_prompt_presets')
      .insert({
        owner_id: scope.owner_id,
        user_id: scope.user_id,
        name: input.name,
        description: input.description,
        system_prompt: input.system_prompt,
      })
      .select(SELECT)
      .single()
    if (error) throw error
    return data as IpPromptPreset
  },

  async update(
    db: SupabaseClient,
    id: string,
    input: { name: string; description: string | null; system_prompt: string },
  ): Promise<IpPromptPreset> {
    const { data, error } = await db
      .from('ip_prompt_presets')
      .update({
        name: input.name,
        description: input.description,
        system_prompt: input.system_prompt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) throw error
    return data as IpPromptPreset
  },

  async remove(db: SupabaseClient, id: string): Promise<void> {
    const { error } = await db.from('ip_prompt_presets').delete().eq('id', id)
    if (error) throw error
  },
}
