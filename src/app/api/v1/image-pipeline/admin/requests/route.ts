import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { adminListRequests, adminResolveRequest } from '@/services/image-pipeline/admin.service'

/** GET /api/v1/image-pipeline/admin/requests — the credit-request queue. */
export async function GET(req: NextRequest) {
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  try {
    return NextResponse.json({ requests: await adminListRequests(db, ctx) })
  } catch (err) {
    return handleError(err, 'IP_ADMIN_REQUESTS_FAILED')
  }
}

/**
 * PATCH — body: { request_id, decision }. Approving grants the credits; the
 * update only matches a still-pending row, so a double click can't grant twice.
 */
export async function PATCH(req: NextRequest) {
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    await adminResolveRequest(db, ctx, body)
    return NextResponse.json({ requests: await adminListRequests(db, ctx) })
  } catch (err) {
    return handleError(err, 'IP_ADMIN_RESOLVE_FAILED')
  }
}
