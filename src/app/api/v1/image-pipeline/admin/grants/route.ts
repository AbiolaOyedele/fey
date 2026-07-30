import { NextRequest, NextResponse } from 'next/server'
import { handleError } from '@/lib/api-helpers'
import { resolvePipelineRequest, readJsonBody } from '@/lib/image-pipeline-context'
import { adminListUsers, adminManualGrant } from '@/services/image-pipeline/admin.service'

/**
 * POST /api/v1/image-pipeline/admin/grants — body: { user_id, amount, note? }
 * One-off credit grant. Lands in the ledger as 'manual_grant', stamped with the
 * acting admin, through the same SECURITY DEFINER function as every other delta.
 */
export async function POST(req: NextRequest) {
  const body = await readJsonBody(req)
  const { db, ctx, response } = await resolvePipelineRequest(req, body.workspace_id as string | undefined)
  if (response) return response
  try {
    await adminManualGrant(db, ctx, body)
    return NextResponse.json({ users: await adminListUsers(db, ctx) })
  } catch (err) {
    return handleError(err, 'IP_ADMIN_GRANT_FAILED')
  }
}
