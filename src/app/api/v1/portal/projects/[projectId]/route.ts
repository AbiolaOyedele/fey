import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as svc from '@/services/portal-projects.service'

/**
 * GET /api/v1/portal/projects/[projectId]
 * Returns one project + its messages + files for the authenticated portal user.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const { projectId } = await ctx.params
  try {
    const detail = await svc.getProjectDetail(createServiceClient(), payload!, projectId)
    return NextResponse.json(detail)
  } catch (err) {
    return handleError(err, 'PORTAL_PROJECT_GET_FAILED')
  }
}
