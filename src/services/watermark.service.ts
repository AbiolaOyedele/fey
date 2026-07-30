import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { destroyCloudinaryAssetById, parseCloudinaryUrl } from '@/lib/cloudinary-server'
import type { Watermark } from '@/types/ruffTool'
import * as repo from '@/repositories/watermark.repository'

/**
 * Ruff Tools · saved watermark library. Binaries are uploaded to Cloudinary
 * client-side (signed); this validates and stores the metadata row so the
 * Watermarker can reuse them across sessions and devices.
 */

interface Ctx {
  userId: string
  ownerId: string
  workspaceId: string | null
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Give the watermark a name.').max(100),
  image_url: z.string().url().startsWith('https://res.cloudinary.com/', 'Invalid image URL.'),
  public_id: z.string().min(1).max(300),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
})

export async function listWatermarks(db: SupabaseClient, ownerId: string): Promise<Watermark[]> {
  return repo.listWatermarks(db, ownerId)
}

export async function createWatermark(db: SupabaseClient, ctx: Ctx, input: unknown): Promise<Watermark> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid watermark.', 'RUFF_WATERMARK_INVALID')
  const d = parsed.data

  return repo.insertWatermark(db, {
    owner_id: ctx.ownerId,
    workspace_id: ctx.workspaceId,
    created_by: ctx.userId,
    name: d.name,
    image_url: d.image_url,
    public_id: d.public_id,
    width: d.width ?? null,
    height: d.height ?? null,
  })
}

/** Soft-deletes a saved watermark, then best-effort removes the Cloudinary asset. */
export async function deleteWatermark(db: SupabaseClient, id: string): Promise<void> {
  const wm = await repo.getWatermarkMeta(db, id)
  if (!wm) throw new AppError(404, 'That watermark could not be found.', 'RUFF_WATERMARK_NOT_FOUND')

  await repo.softDeleteWatermark(db, id)

  const resourceType = parseCloudinaryUrl(`https://res.cloudinary.com/x/image/upload/${wm.public_id}`)?.resourceType ?? 'image'
  const cleaned = await destroyCloudinaryAssetById(wm.public_id, resourceType)
  if (!cleaned) console.warn('[deleteWatermark] Cloudinary cleanup failed (metadata removed)', { id })
}
