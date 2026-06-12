import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requirePortalAuth, handleError } from '@/lib/api-helpers'
import * as portalService from '@/services/portal.service'

/**
 * GET /api/v1/portal/tasks
 * Returns the authenticated portal client's tasks (title + done status only).
 */
export async function GET(req: NextRequest) {
  const { payload, response } = await requirePortalAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createServiceClient()
  try {
    const tasks = await portalService.getPortalTasks(db, payload!.contact_id)
    return NextResponse.json({ tasks })
  } catch (err) {
    return handleError(err, 'PORTAL_TASKS_GET_FAILED')
  }
}
