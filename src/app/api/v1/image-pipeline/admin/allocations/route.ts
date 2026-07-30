import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { adminListUsers, adminUpsertAllocation } from '@/services/image-pipeline/admin.service'

/**
 * PUT /api/v1/image-pipeline/admin/allocations
 * body: { user_id, amount, cadence } — sets a member's recurring grant. An
 * existing schedule is preserved so editing the amount doesn't reset the clock.
 */
export async function PUT(req: NextRequest) {
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    await adminUpsertAllocation(db, ctx, body)
    return NextResponse.json({ users: await adminListUsers(db, ctx) })
  } catch (err) {
    return handleError(err, 'IP_ADMIN_ALLOCATION_FAILED')
  }
}
