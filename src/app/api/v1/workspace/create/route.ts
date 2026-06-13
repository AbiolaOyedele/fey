import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError, errorResponse } from '@/lib/api-helpers'
import { validateSlugFormat } from '@/lib/workspace-slug'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().toLowerCase(),
})

/**
 * POST /api/v1/workspace/create
 * Creates a new workspace owned by the caller (any authenticated user — Slack
 * style) with an 'owner' membership and a #general channel. Slug must be unique
 * across both workspaces and existing owner slugs (fey_settings.workspace_slug).
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch {
    return errorResponse('WORKSPACE_CREATE_INVALID_INPUT', 'Enter a workspace name and address.', 400)
  }
  const { name, slug } = parsed

  const formatError = validateSlugFormat(slug)
  if (formatError) return errorResponse('WORKSPACE_CREATE_BAD_SLUG', formatError, 400)

  try {
    const db = createServiceClient()

    // Uniqueness across workspaces + legacy owner slugs.
    const [{ data: wsClash }, { data: settingsClash }] = await Promise.all([
      db.from('workspaces').select('id').eq('slug', slug).maybeSingle(),
      db.from('fey_settings').select('user_id').eq('workspace_slug', slug).maybeSingle(),
    ])
    if (wsClash || settingsClash) {
      return errorResponse('WORKSPACE_CREATE_SLUG_TAKEN', 'That workspace address is already taken.', 409)
    }

    const { data: ws, error: wsErr } = await db
      .from('workspaces')
      .insert({ name, slug, owner_id: user!.id })
      .select('id, slug')
      .single()
    if (wsErr) throw wsErr
    const workspaceId = (ws as { id: string; slug: string }).id

    const { error: memErr } = await db.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: user!.id,
      role: 'owner',
      email: user!.email ?? null,
      name: (user!.user_metadata?.full_name as string | undefined)
         ?? (user!.user_metadata?.name as string | undefined)
         ?? (user!.email ?? '').split('@')[0],
    })
    if (memErr) throw memErr

    await db.from('internal_channels').insert({ workspace_id: workspaceId, name: 'general', created_by: user!.id })

    return NextResponse.json({ ok: true, workspace_id: workspaceId, slug })
  } catch (err) {
    return handleError(err, 'WORKSPACE_CREATE_FAILED')
  }
}
