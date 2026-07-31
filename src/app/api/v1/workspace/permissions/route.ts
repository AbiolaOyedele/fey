import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { ADMIN_CAPABILITIES, type AdminCapability } from '@/types/team'

const CAPABILITY_KEYS = ADMIN_CAPABILITIES.map((c) => c.key) as [AdminCapability, ...AdminCapability[]]

const patchSchema = z.object({
  workspace_id: z.string().uuid(),
  // Full replacement rather than a delta — the settings UI submits the whole
  // set, so a dropped item is an explicit revoke, not a missing field.
  capabilities: z.array(z.enum(CAPABILITY_KEYS)),
})

/**
 * PATCH /api/v1/workspace/permissions
 * Sets which capabilities the `admin` role holds in a workspace.
 * body: { workspace_id, capabilities: AdminCapability[] }
 *
 * Owner only — deliberately not delegated to the `team` capability, or an admin
 * granted team management could widen their own access.
 */
export async function PATCH(req: NextRequest) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await req.json())
  } catch {
    return errorResponse('WORKSPACE_PERMISSIONS_INVALID_INPUT', 'Choose valid permissions.', 400)
  }

  try {
    const db = createServiceClient()
    const { data: workspace } = await db
      .from('workspaces')
      .select('owner_id')
      .eq('id', body.workspace_id)
      .maybeSingle()

    if (!workspace) {
      return errorResponse('WORKSPACE_NOT_FOUND', 'That workspace no longer exists.', 404)
    }
    if ((workspace as { owner_id: string }).owner_id !== user!.id) {
      return errorResponse(
        'WORKSPACE_PERMISSIONS_FORBIDDEN',
        'Only the workspace owner can change what admins can access.',
        403,
      )
    }

    // De-duplicate so the stored array stays clean for the `?` jsonb check.
    const capabilities = [...new Set(body.capabilities)]
    const { error } = await db
      .from('workspaces')
      .update({ admin_permissions: capabilities })
      .eq('id', body.workspace_id)
    if (error) throw error

    return NextResponse.json({ capabilities })
  } catch (err) {
    return handleError(err, 'WORKSPACE_PERMISSIONS_FAILED')
  }
}
