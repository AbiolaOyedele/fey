import type { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import type { PipelineCtx } from '@/services/image-pipeline/tier.service'

/**
 * Shared entry point for every Image Pipeline route: verify the session
 * (getUser via requireAuth — never getSession), build a user-scoped Supabase
 * client so RLS applies, and resolve the workspace owner scope.
 *
 * Returns a `response` to short-circuit with when unauthenticated, matching the
 * requireAuth convention used across the app.
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

  return {
    db,
    ctx: { userId: user!.id, email: user!.email, ownerId, workspaceId: resolvedWorkspaceId },
    response: null,
  }
}

/** Parses a JSON body, returning `{}` rather than throwing on malformed input. */
export async function readJsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}
