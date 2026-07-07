import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { resolveOwnerContext } from '@/lib/owner-context'
import { listBrands, createBrand } from '@/services/social.service'

/** GET /api/v1/social/brands?workspace_id= — lists the workspace's brand calendars. */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, req.nextUrl.searchParams.get('workspace_id'))
    return NextResponse.json({ brands: await listBrands(db, ownerId) })
  } catch (err) {
    return handleError(err, 'SOCIAL_BRANDS_LIST_FAILED')
  }
}

/** POST /api/v1/social/brands — body: { name, color, contact_id?, workspace_id? } */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: { code: 'SOCIAL_BRAND_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const { ownerId, workspaceId } = await resolveOwnerContext(db, user!.id, body.workspace_id as string | undefined)
    const brand = await createBrand(db, { userId: user!.id, ownerId, workspaceId }, body)
    return NextResponse.json({ brand }, { status: 201 })
  } catch (err) {
    return handleError(err, 'SOCIAL_BRAND_CREATE_FAILED')
  }
}
