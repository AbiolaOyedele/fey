import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { validateSlugFormat } from '@/lib/workspace-slug'

/**
 * GET /api/v1/workspace/check-slug?slug=xxx
 *
 * Checks whether a workspace slug is available.
 * Requires owner auth so random strangers can't enumerate slugs.
 *
 * Response:
 *   { available: true }
 *   { available: false, reason: string }
 */
export async function GET(req: NextRequest) {
  const { response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const slug = req.nextUrl.searchParams.get('slug')?.toLowerCase().trim()

  if (!slug) {
    return errorResponse('WORKSPACE_SLUG_REQUIRED', 'Slug is required.', 400)
  }

  // Format check (shared with the rename endpoint)
  const formatError = validateSlugFormat(slug)
  if (formatError) {
    return NextResponse.json({ available: false, reason: formatError })
  }

  try {
    const db = createServiceClient()
    const { data } = await db
      .from('fey_settings')
      .select('user_id')
      .eq('workspace_slug', slug)
      .maybeSingle()

    if (data) {
      return NextResponse.json({ available: false, reason: 'This workspace name is already taken.' })
    }

    return NextResponse.json({ available: true })
  } catch (err) {
    return handleError(err, 'WORKSPACE_SLUG_CHECK_FAILED')
  }
}
