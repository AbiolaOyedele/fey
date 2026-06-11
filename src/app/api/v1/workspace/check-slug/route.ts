import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'

// Slugs that can't be used — they clash with platform routes or reserved names
const RESERVED_SLUGS = new Set([
  'dashboard', 'www', 'app', 'api', 'admin', 'support',
  'help', 'mail', 'smtp', 'ftp', 'blog', 'status', 'auth',
  'login', 'logout', 'signup', 'register', 'portal', 'client',
])

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

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

  // Format check
  if (slug.length < 3 || slug.length > 30) {
    return NextResponse.json({ available: false, reason: 'Slug must be between 3 and 30 characters.' })
  }
  if (!SLUG_REGEX.test(slug)) {
    return NextResponse.json({ available: false, reason: 'Slug must start and end with a letter or number, and may only contain letters, numbers, and hyphens.' })
  }
  if (RESERVED_SLUGS.has(slug)) {
    return NextResponse.json({ available: false, reason: 'This name is reserved. Please choose a different one.' })
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
