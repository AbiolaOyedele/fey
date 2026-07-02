import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient, createServiceClient } from '@/lib/supabase-server'
import { requireAuth, errorResponse } from '@/lib/api-helpers'
import { recordMentions } from '@/services/mentions.service'

const bodySchema = z.object({
  workspaceId: z.string().uuid().nullable(),
  entityType: z.enum(['task_description', 'subtask', 'internal_message', 'crm_message']),
  entityId: z.string().uuid(),
  link: z.string().min(1).max(500).nullable(),
  contextLabel: z.string().transform((v) => v.slice(0, 300)),
  userIds: z.array(z.string().uuid()).max(50),
})

/**
 * POST /api/v1/mentions
 * Records @mentions parsed client-side from a task description, subtask,
 * internal chat message, or CRM message, and notifies the newly-mentioned
 * users. Body: { workspaceId, entityType, entityId, link, contextLabel, userIds }
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return errorResponse('MENTION_INVALID_BODY', 'Invalid request body.', 400)
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return errorResponse('MENTION_INVALID_BODY', parsed.error.issues[0]?.message ?? 'Invalid request body.', 400)
  }
  const body = parsed.data
  const db = createUserClient(token!)

  // Resolve the actor's display name, and confirm they actually belong to the
  // workspace they're claiming to mention people from (RLS already scopes
  // workspace_members reads to the caller's own workspaces).
  let actorName: string | null = null
  if (body.workspaceId) {
    const { data: member } = await db
      .from('workspace_members')
      .select('name, email')
      .eq('workspace_id', body.workspaceId)
      .eq('user_id', user!.id)
      .maybeSingle()
    if (!member) return errorResponse('MENTION_FORBIDDEN', 'You do not belong to that workspace.', 403)
    const m = member as { name: string | null; email: string | null }
    actorName = m.name ?? (m.email ? m.email.split('@')[0] : null)
  }

  await recordMentions({
    db: createServiceClient(),
    actorId: user!.id,
    actorName,
    workspaceId: body.workspaceId,
    entityType: body.entityType,
    entityId: body.entityId,
    link: body.link,
    contextLabel: body.contextLabel,
    userIds: body.userIds,
  })

  return NextResponse.json({ ok: true })
}
