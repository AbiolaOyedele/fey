import type { SupabaseClient } from '@supabase/supabase-js'
import type { MentionEntityType } from '@/types/mention'

interface InsertMention {
  workspace_id: string | null
  entity_type: MentionEntityType
  entity_id: string
  mentioned_user_id: string
  mentioned_by: string
  link: string | null
}

/**
 * Inserts mention rows, skipping ones already recorded for the same
 * (entity_type, entity_id, mentioned_user_id) — the unique constraint is the
 * notify-once dedup. Returns only the user IDs that were genuinely new.
 */
export async function insertMentionsReturningNew(db: SupabaseClient, rows: InsertMention[]): Promise<string[]> {
  if (rows.length === 0) return []
  const { data, error } = await db
    .from('mentions')
    .upsert(rows, { onConflict: 'entity_type,entity_id,mentioned_user_id', ignoreDuplicates: true })
    .select('mentioned_user_id')
  if (error) throw error
  return ((data ?? []) as Array<{ mentioned_user_id: string }>).map((r) => r.mentioned_user_id)
}
