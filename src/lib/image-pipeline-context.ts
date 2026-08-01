import type { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createUserClient } from '@/lib/supabase-server'
import { errorResponse, requireAuth } from '@/lib/api-helpers'
import { resolveOwnerContext, isMemberOfForeignWorkspace, hasImageCreditsGrant } from '@/lib/owner-context'
import { canUseImagePipeline, type PipelineCtx } from '@/services/image-pipeline/tier.service'

/**
 * Shared entry point for every Image Pipeline route: verify the session
 * (getUser via requireAuth — never getSession), build a user-scoped Supabase
 * client so RLS applies, resolve the workspace owner scope, and apply the
 * module-wide visibility gate.
 *
 * Returns a `response` to short-circuit with when unauthenticated or when the
 * caller isn't allowed into the module, matching the requireAuth convention
 * used across the app.
 */
export async function resolvePipelineRequest(
  req: NextRequest,
  workspaceId?: string | null,
): Promise<
  | { db: SupabaseClient; ctx: PipelineCtx; response: null }
  | { db: null; ctx: null; response: NextResponse }
> {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return { db: null, ctx: null, response }

  const db = createUserClient(token!)
  const requested = workspaceId ?? req.nextUrl.searchParams.get('workspace_id')
  const { ownerId, workspaceId: resolvedWorkspaceId } = await resolveOwnerContext(db, user!.id, requested)

  // Ownership is established here rather than by comparing ids downstream. A
  // request without workspace_id resolves ownerId to the caller, so the naive
  // comparison is true for everyone — including a member of someone else's
  // workspace, who would then get the admin tab and the admin endpoints.
  //
  // A super_admin, or an admin granted `image_credits`, also administers the
  // scope without owning it.
  const ownsScope =
    (ownerId === user!.id && !(await isMemberOfForeignWorkspace(db, user!.id))) ||
    (await hasImageCreditsGrant(db, user!.id, ownerId))

  const ctx: PipelineCtx = {
    userId: user!.id,
    email: user!.email,
    ownerId,
    workspaceId: resolvedWorkspaceId,
    ownsScope,
  }

  // The single gate for the whole module. Every Image Pipeline route resolves
  // through here, so restricting the module is this one check rather than a
  // guard each route has to remember. The cron routes run on the service role
  // and bypass this deliberately — retention cleanup and credit grants must
  // keep running regardless of who can see the UI.
  if (!canUseImagePipeline(ctx)) {
    return {
      db: null,
      ctx: null,
      response: errorResponse('IP_MODULE_FORBIDDEN', 'The Image Pipeline isn’t available on your account.', 403),
    }
  }

  return { db, ctx, response: null }
}

/** Parses a JSON body, returning `{}` rather than throwing on malformed input. */
export async function readJsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}
