import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { sendWelcomeEmail } from '@/services/email.service'
import { appUrl } from '@/config/email'

/**
 * POST /api/v1/workspace/ensure
 * Idempotently ensures the authenticated user owns a workspace (with an 'owner'
 * membership). Called when a new owner finishes setup so they can invite
 * teammates. Existing owners were backfilled by the Phase 1 migration; this
 * covers anyone who signs up afterwards.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const userId = user!.id

  try {
    const db = createServiceClient()

    // Already a member of a workspace? Nothing to do.
    const { data: membership } = await db
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (membership) {
      return NextResponse.json({ ok: true, workspace_id: (membership as { workspace_id: string }).workspace_id, created: false })
    }

    // Pull identity/slug from the owner's settings to name the workspace.
    const { data: settings } = await db
      .from('fey_settings')
      .select('company_name, workspace_name, workspace_slug, username')
      .eq('user_id', userId)
      .maybeSingle()
    const s = settings as { company_name: string | null; workspace_name: string | null; workspace_slug: string | null; username: string | null } | null
    const name = s?.workspace_name?.trim() || s?.company_name?.trim() || 'My workspace'
    // The owner's member identity prefers their typed name, then Google metadata.
    const ownerName = s?.username?.trim()
      || (user!.user_metadata?.full_name as string | undefined)
      || (user!.user_metadata?.name as string | undefined)
      || (user!.email ?? '').split('@')[0]

    const { data: ws, error: wsErr } = await db
      .from('workspaces')
      .insert({ name, slug: s?.workspace_slug ?? null, owner_id: userId })
      .select('id')
      .single()
    if (wsErr) throw wsErr
    const workspaceId = (ws as { id: string }).id

    const { error: memErr } = await db.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner',
      email: user!.email ?? null,
      name: ownerName,
    })
    if (memErr) throw memErr

    // Seed a #general channel so the Playground isn't empty.
    await db.from('internal_channels').insert({ workspace_id: workspaceId, name: 'general', created_by: userId })

    // Best-effort — never blocks workspace creation.
    if (user!.email) {
      void sendWelcomeEmail(user!.email, { name: ownerName, workspaceName: name, dashboardUrl: appUrl() })
        .catch((err) => console.warn('[workspace/ensure] welcome email failed', err))
    }

    return NextResponse.json({ ok: true, workspace_id: workspaceId, created: true })
  } catch (err) {
    return handleError(err, 'WORKSPACE_ENSURE_FAILED')
  }
}
