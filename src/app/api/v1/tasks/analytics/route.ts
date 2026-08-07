import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { resolveOwnerContext, isWorkspaceAdmin } from '@/lib/owner-context'
import { getTaskAnalytics } from '@/services/task-analytics.service'

/**
 * GET /api/v1/tasks/analytics
 *   ?workspace_id= &range=30d|90d|12m &tz_offset= &project_id= &contact_id= &assignee_id=
 *
 * Aggregated task activity for the insights panel. Read-only, RLS-enforced, and
 * narrowed to what a member may see the same way the task list is.
 * `tz_offset` is Date#getTimezoneOffset() from the browser, so days are bucketed
 * as the viewer's calendar days rather than UTC ones.
 */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const sp = req.nextUrl.searchParams
  const rawOffset = Number(sp.get('tz_offset'))

  const db = createUserClient(token!)
  try {
    const { ownerId } = await resolveOwnerContext(db, user!.id, sp.get('workspace_id'))
    const isAdmin = await isWorkspaceAdmin(db, user!.id, ownerId)
    const analytics = await getTaskAnalytics(
      db,
      ownerId,
      {
        range: sp.get('range') ?? undefined,
        tzOffset: Number.isFinite(rawOffset) ? rawOffset : 0,
        projectId: sp.get('project_id'),
        contactId: sp.get('contact_id'),
        assigneeId: sp.get('assignee_id'),
      },
      { id: user!.id, isAdmin },
    )
    return NextResponse.json({ analytics })
  } catch (err) {
    return handleError(err, 'TASK_ANALYTICS_FAILED')
  }
}
