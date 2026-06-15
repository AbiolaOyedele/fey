import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as svc from '@/services/portal-projects.service'

/**
 * GET /api/v1/portal/projects
 * Lists the authenticated portal user's (non-archived) projects.
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  try {
    const projects = await svc.listProjects(createServiceClient(), payload!)
    return NextResponse.json({ projects })
  } catch (err) {
    return handleError(err, 'PORTAL_PROJECTS_GET_FAILED')
  }
}
