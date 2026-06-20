import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as svc from '@/services/portal-projects.service'
import { notifyOwnerAdmins } from '@/services/notifications.service'

/**
 * POST /api/v1/portal/projects/[projectId]/messages
 * Sends a message in a project as the authenticated portal user.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const { projectId } = await ctx.params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'PORTAL_PROJECT_MSG_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  try {
    const db = createServiceClient()
    const message = await svc.sendMessage(db, payload!, projectId, body)
    await notifyOwnerAdmins(db, payload!.owner_id, {
      type: 'project_message',
      title: 'New project message',
      body: 'A client replied in a project.',
      link: `/projects/${projectId}`,
      entityType: 'project',
      entityId: projectId,
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    return handleError(err, 'PORTAL_PROJECT_MSG_SEND_FAILED')
  }
}
