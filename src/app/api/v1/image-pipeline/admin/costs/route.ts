import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest } from '@/lib/image-pipeline-context'
import { adminCostDashboard } from '@/services/image-pipeline/admin.service'

/**
 * GET /api/v1/image-pipeline/admin/costs?period=week|month
 * Credits used per member, estimated USD spend (usage x the live rate card) and
 * budgeted spend (credits allocated x the anchor rate).
 */
export async function GET(req: NextRequest) {
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  const period = req.nextUrl.searchParams.get('period') === 'month' ? 'month' : 'week'
  try {
    return NextResponse.json(await adminCostDashboard(db, ctx, period))
  } catch (err) {
    return handleError(err, 'IP_ADMIN_COSTS_FAILED')
  }
}
