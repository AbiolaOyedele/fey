import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import { listWatermarks, createWatermark } from '@/services/watermark.service'

/** GET /api/v1/ruff/watermarks?workspace_id= — the workspace's saved watermarks. */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, req.nextUrl.searchParams.get('workspace_id'))
    return NextResponse.json({ watermarks: await listWatermarks(db, ownerId) })
  } catch (err) {
    return handleError(err, 'RUFF_WATERMARKS_LIST_FAILED')
  }
}

/** POST /api/v1/ruff/watermarks — body: { name, image_url, public_id, width?, height?, workspace_id? } */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: { code: 'RUFF_WATERMARK_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const { ownerId, workspaceId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const watermark = await createWatermark(db, { userId: user!.id, ownerId, workspaceId }, body)
    return NextResponse.json({ watermark }, { status: 201 })
  } catch (err) {
    return handleError(err, 'RUFF_WATERMARK_CREATE_FAILED')
  }
}
