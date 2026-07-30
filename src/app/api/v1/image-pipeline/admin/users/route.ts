import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { adminListUsers, adminSetTierOverride } from '@/services/image-pipeline/admin.service'

/**
 * GET /api/v1/image-pipeline/admin/users — members in scope with tier, skip
 * preference, balance and allocation. Admin rights are re-verified server-side.
 */
export async function GET(req: NextRequest) {
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  try {
    return NextResponse.json({ users: await adminListUsers(db, ctx) })
  } catch (err) {
    return handleError(err, 'IP_ADMIN_USERS_FAILED')
  }
}

/** PATCH — body: { user_id, image_tier_override } (null clears the override). */
export async function PATCH(req: NextRequest) {
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    await adminSetTierOverride(db, ctx, body)
    return NextResponse.json({ users: await adminListUsers(db, ctx) })
  } catch (err) {
    return handleError(err, 'IP_ADMIN_TIER_FAILED')
  }
}
