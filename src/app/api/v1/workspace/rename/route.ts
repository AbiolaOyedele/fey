import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { validateSlugFormat } from '@/lib/workspace-slug'

/**
 * POST /api/v1/workspace/rename   body: { slug }
 *
 * Changes the authenticated owner's workspace slug (subdomain). Updates
 * fey_settings.workspace_slug AND portal_users.workspace_slug so existing
 * portal clients keep access. Existing invite links (which embed the old slug)
 * stop working — the owner must re-share.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  const userId = user?.id
  if (response) return response

  let body: unknown
  try { body = await req.json() } catch {
    return errorResponse('WORKSPACE_RENAME_INVALID_BODY', 'Invalid request body.', 400)
  }

  const slug = String((body as { slug?: string })?.slug ?? '').toLowerCase().trim()
  const formatError = validateSlugFormat(slug)
  if (formatError) return errorResponse('WORKSPACE_SLUG_INVALID', formatError, 400)

  try {
    const db = createServiceClient()

    // Uniqueness — allow the owner's own current slug (no-op rename).
    const { data: existing } = await db
      .from('fey_settings')
      .select('user_id')
      .eq('workspace_slug', slug)
      .maybeSingle()

    if (existing && (existing as { user_id: string }).user_id !== userId) {
      return errorResponse('WORKSPACE_SLUG_TAKEN', 'This workspace name is already taken.', 409)
    }
    if (existing) {
      return NextResponse.json({ success: true, slug }) // already theirs — nothing to do
    }

    // Move the workspace.
    const { error: settingsErr } = await db
      .from('fey_settings')
      .update({ workspace_slug: slug })
      .eq('user_id', userId!)
    if (settingsErr) throw settingsErr

    // Keep existing portal clients pointed at the new slug.
    const { error: usersErr } = await db
      .from('portal_users')
      .update({ workspace_slug: slug })
      .eq('owner_id', userId!)
    if (usersErr) throw usersErr

    return NextResponse.json({ success: true, slug })
  } catch (err) {
    return handleError(err, 'WORKSPACE_RENAME_FAILED')
  }
}
