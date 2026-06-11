import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'

/**
 * GET /api/v1/crm/notifications
 */
export async function GET(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const notifications = await crmService.getNotifications(db, user!.id)
    return NextResponse.json({ notifications })
  } catch (err) {
    return handleError(err, 'CRM_NOTIFICATIONS_GET_FAILED')
  }
}

/**
 * POST /api/v1/crm/notifications/read — marks all notifications read
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    await crmService.markAllNotificationsRead(db, user!.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleError(err, 'CRM_NOTIFICATIONS_READ_FAILED')
  }
}
