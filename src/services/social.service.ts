import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import type { SocialBrand, SocialPost } from '@/types/social'
import * as repo from '@/repositories/social.repository'
import { createTask } from '@/services/work-tasks.service'

/**
 * Playground · Social Corner business logic. Brands are calendar spaces
 * (optionally linked to a CRM contact); posts sit on calendar dates and can be
 * promoted to work_tasks so they appear on the main Tasks page.
 */

interface Ctx {
  userId: string
  ownerId: string
  workspaceId: string | null
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a brand color.')
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.')
const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time.').nullable().optional()
const statusSchema = z.enum(['draft', 'pending_review', 'reviewed', 'approved'])
const formatSchema = z.enum(['static', 'motion', 'carousel', 'story', 'reel', 'text']).nullable().optional()

const createBrandSchema = z.object({
  name: z.string().trim().min(1, 'Give the brand a name.').max(100),
  color: hexColor,
  contact_id: z.string().uuid().nullable().optional(),
})

const updateBrandSchema = createBrandSchema.partial()

const createPostSchema = z.object({
  brand_id: z.string().uuid(),
  scheduled_date: dateSchema,
  scheduled_time: timeSchema,
  title: z.string().trim().min(1, 'Give the post a title.').max(300),
  content_pillar: z.string().trim().max(100).nullable().optional(),
  format: formatSchema,
  visual_notes: z.string().max(5000).nullable().optional(),
  caption: z.string().max(5000).nullable().optional(),
  inspo_url: z.string().trim().url('Inspo must be a valid link.').max(2000).nullable().optional().or(z.literal('').transform(() => null)),
  status: statusSchema.optional(),
})

const updatePostSchema = createPostSchema.partial()

/** Verifies a CRM contact belongs to this owner before linking a brand to it. */
async function assertContactOwned(db: SupabaseClient, ownerId: string, contactId: string): Promise<void> {
  const { data, error } = await db
    .from('crm_contacts')
    .select('id')
    .eq('id', contactId)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new AppError(404, 'That client could not be found.', 'SOCIAL_BRAND_CONTACT_NOT_FOUND')
}

// ── Brands ────────────────────────────────────────────────────────────────────

export async function listBrands(db: SupabaseClient, ownerId: string): Promise<SocialBrand[]> {
  return repo.listBrands(db, ownerId)
}

export async function createBrand(db: SupabaseClient, ctx: Ctx, input: unknown): Promise<SocialBrand> {
  const parsed = createBrandSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid brand.', 'SOCIAL_BRAND_INVALID')
  const d = parsed.data

  if (d.contact_id) await assertContactOwned(db, ctx.ownerId, d.contact_id)

  const id = await repo.insertBrand(db, {
    owner_id: ctx.ownerId,
    workspace_id: ctx.workspaceId,
    contact_id: d.contact_id ?? null,
    created_by: ctx.userId,
    name: d.name,
    color: d.color.toUpperCase(),
  })
  const brand = await repo.getBrand(db, id)
  if (!brand) throw new AppError(500, 'The brand was not saved. Please try again.', 'SOCIAL_BRAND_CREATE_FAILED')
  return brand
}

export async function updateBrand(db: SupabaseClient, ctx: Ctx, id: string, input: unknown): Promise<SocialBrand> {
  const existing = await repo.getBrand(db, id)
  if (!existing) throw new AppError(404, 'That brand could not be found.', 'SOCIAL_BRAND_NOT_FOUND')

  const parsed = updateBrandSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid update.', 'SOCIAL_BRAND_INVALID')
  const d = parsed.data

  if (d.contact_id) await assertContactOwned(db, ctx.ownerId, d.contact_id)

  const updates: Record<string, unknown> = {}
  if (d.name !== undefined) updates.name = d.name
  if (d.color !== undefined) updates.color = d.color.toUpperCase()
  if (d.contact_id !== undefined) updates.contact_id = d.contact_id
  if (Object.keys(updates).length > 0) await repo.updateBrandRow(db, id, updates)

  const brand = await repo.getBrand(db, id)
  if (!brand) throw new AppError(500, 'The brand was not saved. Please try again.', 'SOCIAL_BRAND_UPDATE_FAILED')
  return brand
}

export async function deleteBrand(db: SupabaseClient, id: string): Promise<void> {
  const existing = await repo.getBrand(db, id)
  if (!existing) throw new AppError(404, 'That brand could not be found.', 'SOCIAL_BRAND_NOT_FOUND')
  await repo.softDeleteBrand(db, id)
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function listPosts(
  db: SupabaseClient,
  ownerId: string,
  args: { from: string; to: string; brandId?: string | null },
): Promise<SocialPost[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.from) || !/^\d{4}-\d{2}-\d{2}$/.test(args.to)) {
    throw new AppError(400, 'Invalid date range.', 'SOCIAL_POSTS_INVALID_RANGE')
  }
  return repo.listPosts(db, ownerId, args)
}

export async function createPost(db: SupabaseClient, ctx: Ctx, input: unknown): Promise<SocialPost> {
  const parsed = createPostSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid post.', 'SOCIAL_POST_INVALID')
  const d = parsed.data

  const brand = await repo.getBrand(db, d.brand_id)
  if (!brand) throw new AppError(404, 'That brand could not be found.', 'SOCIAL_POST_BRAND_NOT_FOUND')

  return repo.insertPost(db, {
    owner_id: ctx.ownerId,
    workspace_id: ctx.workspaceId,
    brand_id: d.brand_id,
    created_by: ctx.userId,
    scheduled_date: d.scheduled_date,
    scheduled_time: d.scheduled_time ?? null,
    title: d.title,
    content_pillar: d.content_pillar ?? null,
    format: d.format ?? null,
    visual_notes: d.visual_notes ?? null,
    caption: d.caption ?? null,
    inspo_url: d.inspo_url ?? null,
    status: d.status ?? 'draft',
  })
}

export async function updatePost(db: SupabaseClient, id: string, input: unknown): Promise<SocialPost> {
  const existing = await repo.getPost(db, id)
  if (!existing) throw new AppError(404, 'That post could not be found.', 'SOCIAL_POST_NOT_FOUND')

  const parsed = updatePostSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid update.', 'SOCIAL_POST_INVALID')
  const d = parsed.data

  if (d.brand_id) {
    const brand = await repo.getBrand(db, d.brand_id)
    if (!brand) throw new AppError(404, 'That brand could not be found.', 'SOCIAL_POST_BRAND_NOT_FOUND')
  }

  const updates: Record<string, unknown> = {}
  for (const key of ['brand_id', 'scheduled_date', 'scheduled_time', 'title', 'content_pillar', 'format', 'visual_notes', 'caption', 'inspo_url', 'status'] as const) {
    if (d[key] !== undefined) updates[key] = d[key]
  }
  if (Object.keys(updates).length === 0) return existing
  return repo.updatePostRow(db, id, updates)
}

export async function deletePost(db: SupabaseClient, id: string): Promise<void> {
  const existing = await repo.getPost(db, id)
  if (!existing) throw new AppError(404, 'That post could not be found.', 'SOCIAL_POST_NOT_FOUND')
  await repo.softDeletePost(db, id)
}

/**
 * Promotes a post to a work_task on the main Tasks page (team-visible, due on
 * the scheduled date, linked to the brand's CRM contact when there is one) and
 * stores the link on the post. Idempotent: returns the existing link if set.
 */
export async function markPostAsTask(
  db: SupabaseClient,
  ctx: Ctx,
  postId: string,
  assigneeIds: string[] = [],
): Promise<SocialPost> {
  const post = await repo.getPost(db, postId)
  if (!post) throw new AppError(404, 'That post could not be found.', 'SOCIAL_POST_NOT_FOUND')
  if (post.work_task_id) return post

  const brand = await repo.getBrand(db, post.brand_id)
  if (!brand) throw new AppError(404, 'That brand could not be found.', 'SOCIAL_POST_BRAND_NOT_FOUND')

  const task = await createTask(db, ctx, {
    title: `${brand.name}: ${post.title}`,
    description: post.caption ?? null,
    contact_id: brand.contact_id,
    visibility: 'team',
    due_date: post.scheduled_date,
    assignee_ids: assigneeIds,
  })

  return repo.updatePostRow(db, postId, { work_task_id: task.id })
}
