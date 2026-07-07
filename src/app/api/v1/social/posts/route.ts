import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import { listPosts, createPost } from '@/services/social.service'

/** GET /api/v1/social/posts?from=&to=&brand_id=&workspace_id= — posts in a date range. */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const sp = req.nextUrl.searchParams
  const from = sp.get('from')
  const to = sp.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: { code: 'SOCIAL_POSTS_MISSING_RANGE', message: 'A date range is required.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, sp.get('workspace_id'))
    const posts = await listPosts(db, ownerId, { from, to, brandId: sp.get('brand_id') })
    return NextResponse.json({ posts })
  } catch (err) {
    return handleError(err, 'SOCIAL_POSTS_LIST_FAILED')
  }
}

/** POST /api/v1/social/posts — body: CreatePostPayload + workspace_id? */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: { code: 'SOCIAL_POST_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const { ownerId, workspaceId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const post = await createPost(db, { userId: user!.id, ownerId, workspaceId }, body)
    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    return handleError(err, 'SOCIAL_POST_CREATE_FAILED')
  }
}
