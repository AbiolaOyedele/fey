import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/config/env'
import { getMetrics, getFeedbackInbox } from '@/services/admin.service'

/**
 * GET /api/v1/admin/metrics
 * Returns the full admin metrics snapshot + feedback inbox.
 * Restricted to emails in the ADMIN_EMAILS allowlist. Reads via the service
 * role (RLS bypassed) only after the caller is verified as an admin.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  if (!isAdminEmail(user!.email)) {
    return errorResponse('ADMIN_FORBIDDEN', 'You don’t have access to this page.', 403)
  }

  try {
    const db = createServiceClient()
    const [metrics, feedback] = await Promise.all([getMetrics(db), getFeedbackInbox(db)])
    return NextResponse.json({ metrics, feedback })
  } catch (err) {
    return handleError(err, 'ADMIN_METRICS_FAILED')
  }
}
