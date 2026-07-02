import type { SupabaseClient } from '@supabase/supabase-js'
import { notify } from '@/services/notifications.service'
import * as repo from '@/repositories/mentions.repository'
import type { MentionEntityType } from '@/types/mention'

interface RecordMentionsArgs {
  db: SupabaseClient // service-role — mentions/notifications are written for other users
  actorId: string
  actorName: string | null
  workspaceId: string | null
  entityType: MentionEntityType
  entityId: string
  link: string | null
  contextLabel: string
  userIds: string[]
}

/**
 * Records new @mentions (notify-once, deduped by the DB unique constraint) and
 * notifies only the genuinely-new recipients. Best-effort — never throws, so a
 * mention never blocks the save/send that triggered it.
 */
export async function recordMentions(args: RecordMentionsArgs): Promise<void> {
  try {
    const recipients = [...new Set(args.userIds)].filter((id) => id && id !== args.actorId)
    if (recipients.length === 0) return

    const newlyMentioned = await repo.insertMentionsReturningNew(
      args.db,
      recipients.map((mentioned_user_id) => ({
        workspace_id: args.workspaceId,
        entity_type: args.entityType,
        entity_id: args.entityId,
        mentioned_user_id,
        mentioned_by: args.actorId,
        link: args.link,
      })),
    )
    if (newlyMentioned.length === 0) return

    await notify({
      db: args.db,
      recipientIds: newlyMentioned,
      workspaceId: args.workspaceId,
      actorId: args.actorId,
      type: 'mention',
      title: args.actorName ? `${args.actorName} mentioned you` : 'You were mentioned',
      body: args.contextLabel,
      link: args.link,
      entityType: args.entityType,
      entityId: args.entityId,
    })
  } catch (err) {
    console.warn('[recordMentions] failed:', err)
  }
}
