import type { SupabaseClient } from '@supabase/supabase-js'
import type { SocialBrand, SocialPost } from '@/types/social'

/**
 * All Social Corner queries (social_brands + social_posts). Callers pass a
 * user-scoped client so RLS (workspace membership) is enforced.
 */

const BRAND_SELECT = `
  id, contact_id, name, color, created_at,
  crm_contacts:contact_id ( name )
`

const POST_SELECT = `
  id, brand_id, work_task_id, scheduled_date, scheduled_time,
  title, content_pillar, format, visual_notes, caption, inspo_url,
  status, created_at, updated_at
`

interface RawBrand {
  id: string
  contact_id: string | null
  name: string
  color: string
  created_at: string
  crm_contacts: { name: string } | { name: string }[] | null
}

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function mapBrand(row: RawBrand): SocialBrand {
  return {
    id: row.id,
    contact_id: row.contact_id,
    contact_name: one(row.crm_contacts)?.name ?? null,
    name: row.name,
    color: row.color,
    created_at: row.created_at,
  }
}

// ── Brands ────────────────────────────────────────────────────────────────────

export async function listBrands(db: SupabaseClient, ownerId: string): Promise<SocialBrand[]> {
  const { data, error } = await db
    .from('social_brands')
    .select(BRAND_SELECT)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as RawBrand[]).map(mapBrand)
}

export async function getBrand(db: SupabaseClient, id: string): Promise<SocialBrand | null> {
  const { data, error } = await db
    .from('social_brands')
    .select(BRAND_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data ? mapBrand(data as unknown as RawBrand) : null
}

export async function insertBrand(db: SupabaseClient, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.from('social_brands').insert(row).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function updateBrandRow(db: SupabaseClient, id: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await db
    .from('social_brands')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Soft-deletes a brand and all of its posts. */
export async function softDeleteBrand(db: SupabaseClient, id: string): Promise<void> {
  const now = new Date().toISOString()
  const { error: postsErr } = await db.from('social_posts').update({ deleted_at: now }).eq('brand_id', id)
  if (postsErr) throw postsErr
  const { error } = await db.from('social_brands').update({ deleted_at: now }).eq('id', id)
  if (error) throw error
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function listPosts(
  db: SupabaseClient,
  ownerId: string,
  args: { from: string; to: string; brandId?: string | null },
): Promise<SocialPost[]> {
  let q = db
    .from('social_posts')
    .select(POST_SELECT)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .gte('scheduled_date', args.from)
    .lte('scheduled_date', args.to)
  if (args.brandId) q = q.eq('brand_id', args.brandId)
  const { data, error } = await q
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as unknown as SocialPost[]
}

export async function getPost(db: SupabaseClient, id: string): Promise<SocialPost | null> {
  const { data, error } = await db
    .from('social_posts')
    .select(POST_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as SocialPost | null
}

export async function insertPost(db: SupabaseClient, row: Record<string, unknown>): Promise<SocialPost> {
  const { data, error } = await db.from('social_posts').insert(row).select(POST_SELECT).single()
  if (error) throw error
  return data as unknown as SocialPost
}

export async function updatePostRow(db: SupabaseClient, id: string, updates: Record<string, unknown>): Promise<SocialPost> {
  const { data, error } = await db
    .from('social_posts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(POST_SELECT)
    .single()
  if (error) throw error
  return data as unknown as SocialPost
}

export async function softDeletePost(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('social_posts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
