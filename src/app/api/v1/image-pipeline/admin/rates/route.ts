import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase-server'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { adminGetRates, adminUpdateRates } from '@/services/image-pipeline/admin.service'

/** GET /api/v1/image-pipeline/admin/rates — the live rate card. */
export async function GET(req: NextRequest) {
  const { db, ctx, response } = await resolvePipelineRequest(req)
  if (response) return response
  try {
    return NextResponse.json({ rates: await adminGetRates(db, ctx) })
  } catch (err) {
    return handleError(err, 'IP_ADMIN_RATES_FAILED')
  }
}

/**
 * PATCH — body: { rates: { <key>: value } }
 *
 * Rates are global platform config with no owner column, so the table has no
 * user write policy: the write goes through the service-role client behind an
 * explicit platform super-admin check in the service.
 */
export async function PATCH(req: NextRequest) {
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    const rates = await adminUpdateRates(db, createServiceClient(), ctx, body)
    return NextResponse.json({ rates })
  } catch (err) {
    return handleError(err, 'IP_ADMIN_RATES_UPDATE_FAILED')
  }
}
