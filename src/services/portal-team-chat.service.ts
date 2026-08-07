import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { isReadOnly } from '@/services/portal-members.service'
import { canDeleteForEveryone } from '@/types/chat'
import type { PortalUser } from '@/types/crm'

/**
 * The client's private room.
 *
 * One conversation per contact: everyone with portal access to that contact
 * shares it, and nobody else can reach it. `portal_team_messages` has RLS
 * enabled and NO policy at all — not even for the workspace owner — so the only
 * way in is the service role, behind a route that has verified a portal JWT.
 * That is the whole feature: if the agency could read it, "chat privately"
 * would be a lie.
 *
 * Because there is no policy to fall back on, the contact_id scoping in this
 * file is the only thing separating one client's room from another's. It always
 * comes from the verified token, never the request body.
 */

export interface PortalTeamMessage {
  id: string
  contact_id: string
  /** Null once that person has been deleted — the message itself is kept. */
  sender_id: string | null
  sender_name: string
  body: string
  attachments: unknown[]
  reply_to_id: string | null
  edited_at: string | null
  deleted_at: string | null
  created_at: string
}

const SELECT = 'id, contact_id, sender_id, body, attachments, reply_to_id, edited_at, deleted_at, created_at'

/**
 * Sender names are resolved here rather than joined: portal_users is a separate
 * table with no FK the PostgREST embed can follow cheaply, and a room holds a
 * handful of people at most.
 */
async function withNames(
  db: SupabaseClient,
  rows: Record<string, unknown>[],
  contactId: string,
): Promise<PortalTeamMessage[]> {
  const { data: people } = await db
    .from('portal_users')
    .select('id, name')
    .eq('contact_id', contactId)
  const nameById = new Map(
    ((people ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
  )
  return rows.map((r) => {
    // Null sender means the author was deleted from the portal. The message
    // stays — the rest of the room still needs the conversation to read
    // straight — but it's attributed to nobody.
    const senderId = (r.sender_id as string | null) ?? null
    return {
      id:          r.id as string,
      contact_id:  r.contact_id as string,
      sender_id:   senderId,
      sender_name: senderId === null ? 'Removed member' : nameById.get(senderId) ?? 'Teammate',
      body:        (r.body as string) ?? '',
      attachments: (r.attachments as unknown[]) ?? [],
      reply_to_id: (r.reply_to_id as string | null) ?? null,
      edited_at:   (r.edited_at as string | null) ?? null,
      deleted_at:  (r.deleted_at as string | null) ?? null,
      created_at:  r.created_at as string,
    }
  })
}

export async function listMessages(
  db: SupabaseClient,
  contactId: string,
): Promise<PortalTeamMessage[]> {
  const { data, error } = await db
    .from('portal_team_messages')
    .select(SELECT)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
    .limit(300)
  if (error) throw error
  return withNames(db, (data ?? []) as Record<string, unknown>[], contactId)
}

const sendSchema = z.object({
  body:        z.string().min(1, 'Write something first.').max(8000),
  reply_to_id: z.string().uuid().nullish(),
})

export async function sendMessage(
  db: SupabaseClient,
  scope: { contactId: string; ownerId: string },
  actor: Pick<PortalUser, 'id' | 'role'>,
  input: unknown,
): Promise<PortalTeamMessage> {
  if (isReadOnly(actor.role)) {
    throw new AppError(403, 'Your access is view-only, so you can’t post here.', 'PORTAL_CHAT_FORBIDDEN')
  }
  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'That message isn’t valid.', 'PORTAL_CHAT_INVALID')
  }

  const { data, error } = await db
    .from('portal_team_messages')
    .insert({
      contact_id:  scope.contactId,
      owner_id:    scope.ownerId,
      sender_id:   actor.id,
      body:        parsed.data.body,
      reply_to_id: parsed.data.reply_to_id ?? null,
    })
    .select(SELECT)
    .single()
  if (error) throw error
  const [message] = await withNames(db, [data as Record<string, unknown>], scope.contactId)
  if (!message) throw new AppError(500, 'The message was sent but couldn’t be loaded.', 'PORTAL_CHAT_RELOAD_FAILED')
  return message
}

/**
 * Delete for everyone in the room — permanently.
 *
 * Same 48h window as the rest of the app, with the client's own admin able to
 * remove anyone's message: there is no agency moderator here by design, so
 * without that a room could be left with something nobody can take down.
 *
 * Nothing is left behind. The tombstone this used to write advertised that a
 * message had existed, which is the thing people are trying to undo.
 */
export async function deleteMessage(
  db: SupabaseClient,
  scope: { contactId: string },
  actor: Pick<PortalUser, 'id' | 'role'>,
  messageId: string,
): Promise<void> {
  const { data, error } = await db
    .from('portal_team_messages')
    .select('id, sender_id, created_at, deleted_at')
    .eq('id', messageId)
    .eq('contact_id', scope.contactId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new AppError(404, 'That message could not be found.', 'PORTAL_CHAT_NOT_FOUND')

  const row = data as { id: string; sender_id: string; created_at: string; deleted_at: string | null }
  if (!canDeleteForEveryone(row, actor.id, actor.role === 'client_admin')) {
    throw new AppError(403, 'You can’t delete that message.', 'PORTAL_CHAT_DELETE_FORBIDDEN')
  }

  const { error: delError } = await db
    .from('portal_team_messages')
    .delete()
    .eq('id', messageId)
    .eq('contact_id', scope.contactId)
  if (delError) throw delError
}

/**
 * Empties the client's private room.
 *
 * Only their own admin may do it: this room has no agency moderator, so the
 * person who can remove anyone's message is the same person who can clear it.
 */
export async function clearMessages(
  db: SupabaseClient,
  scope: { contactId: string },
  actor: Pick<PortalUser, 'role'>,
): Promise<{ cleared: number }> {
  if (actor.role !== 'client_admin') {
    throw new AppError(403, 'Only an account admin can clear this chat.', 'PORTAL_CHAT_CLEAR_FORBIDDEN')
  }
  const { data, error } = await db
    .from('portal_team_messages')
    .delete()
    .eq('contact_id', scope.contactId)
    .select('id')
  if (error) throw error
  return { cleared: (data ?? []).length }
}
