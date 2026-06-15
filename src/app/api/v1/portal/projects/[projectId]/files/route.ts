import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as svc from '@/services/portal-projects.service'

/**
 * POST /api/v1/portal/projects/[projectId]/files
 * Records an uploaded file against a project as the authenticated portal user.
 * (The file itself is uploaded to Cloudinary client-side first.)
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const { projectId } = await ctx.params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'PORTAL_PROJECT_FILE_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  try {
    const file = await svc.addFile(createServiceClient(), payload!, projectId, body)
    return NextResponse.json({ file }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_PROJECT_FILE_ADD_FAILED')
  }
}
