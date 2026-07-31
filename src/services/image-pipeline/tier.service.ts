import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/config/env'
import { userSettingsRepository as settingsRepo } from '@/repositories/image-pipeline/settings.repository'
import type { ImagePipelineAdminContext, ImageTier, TierResolution } from '@/types/image-pipeline'

/**
 * Tier resolution and admin capability, both resolved server-side from the
 * verified session. The client never sends a tier — anything tier-shaped in a
 * request body is ignored.
 *
 * Admin, per the module's decision record, is the platform super admin (the
 * ADMIN_EMAILS allowlist) OR the owner of the active workspace. Ordinary
 * workspace member-admins are not Image Pipeline admins.
 */

export interface PipelineCtx {
  userId: string
  email: string | null | undefined
  ownerId: string
  workspaceId: string | null
  /**
   * Whether the caller genuinely owns this scope. Resolved in
   * resolvePipelineRequest, NOT inferred from `ownerId === userId`: when a
   * request omits workspace_id, resolveOwnerContext falls back to the caller's
   * own id, which that comparison reads as ownership and would hand every
   * member the admin surface.
   */
  ownsScope: boolean
}

export function resolveAdminContext(ctx: PipelineCtx): ImagePipelineAdminContext {
  return {
    is_super_admin: isAdminEmail(ctx.email),
    is_workspace_owner: ctx.ownsScope,
  }
}

export function isPipelineAdmin(ctx: PipelineCtx): boolean {
  const admin = resolveAdminContext(ctx)
  return admin.is_super_admin || admin.is_workspace_owner
}

/**
 * Resolves the tier for a user, in order:
 *   1. an explicit admin-set override
 *   2. admins default to pro
 *   3. everyone else is standard
 */
export async function resolveTier(db: SupabaseClient, ctx: PipelineCtx): Promise<TierResolution> {
  const settings = await settingsRepo.getForUser(db, ctx.userId)
  if (settings?.image_tier_override) {
    return { tier: settings.image_tier_override, source: 'override' }
  }
  if (isPipelineAdmin(ctx)) return { tier: 'pro', source: 'admin_default' }
  return { tier: 'standard', source: 'standard_default' }
}

/**
 * Tier for another user in the same owner scope (admin user list). Only the
 * override and the standard default apply — an admin viewing the list is not
 * evidence about the listed member's own role.
 */
export function resolveTierFor(override: ImageTier | null, isOwner: boolean): ImageTier {
  if (override) return override
  return isOwner ? 'pro' : 'standard'
}
