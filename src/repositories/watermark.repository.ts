import type { SupabaseClient } from '@supabase/supabase-js'
import type { Watermark } from '@/types/ruffTool'

/**
 * Queries for the saved watermark library (ruff_watermarks). Callers pass a
 * user-scoped client so RLS (workspace membership) is enforced.
 */

const SELECT = 'id, name, image_url, public_id, width, height, created_at'

export async function listWatermarks(db: SupabaseClient, ownerId: string): Promise<Watermark[]> {
  const { data, error } = await db
    .from('ruff_watermarks')
    .select(SELECT)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Watermark[]
}

export async function insertWatermark(db: SupabaseClient, row: Record<string, unknown>): Promise<Watermark> {
  const { data, error } = await db.from('ruff_watermarks').insert(row).select(SELECT).single()
  if (error) throw error
  return data as Watermark
}

/** Reads a watermark's owner + public_id for ownership checks and cleanup. */
export async function getWatermarkMeta(
  db: SupabaseClient,
  id: string,
): Promise<{ id: string; owner_id: string; public_id: string } | null> {
  const { data, error } = await db
    .from('ruff_watermarks')
    .select('id, owner_id, public_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return (data as { id: string; owner_id: string; public_id: string } | null) ?? null
}

export async function softDeleteWatermark(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db
    .from('ruff_watermarks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
