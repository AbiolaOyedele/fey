'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { summariseReactions, type MessageReaction, type MessageScope, type ReactionSummary } from '@/types/chat'

/**
 * Emoji reactions for a set of messages, in any scope.
 *
 * One hook rather than one per surface: internal chat, CRM messages and the
 * portal all store reactions in the same table keyed by (message_id, scope), so
 * the only thing that differs is which ids to load.
 *
 * `reactor_name` is denormalised onto the row on purpose. Auth users and portal
 * users live in different tables with no shared join, so a name resolved at
 * write time is the only way one query can render "Ada and 2 others" for a
 * thread that mixes both.
 */

interface ReactionState {
  /** message_id → collapsed summaries, ready to render. */
  byMessage: Map<string, ReactionSummary[]>
  toggle: (messageId: string, emoji: string) => Promise<void>
}

export function useMessageReactions(
  scope: MessageScope,
  messageIds: string[],
  viewer: { id: string; name: string } | null,
): ReactionState {
  const [rows, setRows] = useState<MessageReaction[]>([])

  // Joined into a single key so the effect re-runs when the set actually
  // changes, not on every render that rebuilds the array.
  const key = messageIds.join(',')

  useEffect(() => {
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('scope', scope)
        .in('message_id', key.split(','))
      if (cancelled) return
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows((data ?? []) as MessageReaction[])
    })()
    return () => { cancelled = true }
  }, [scope, key])

  const toggle = useCallback(async (messageId: string, emoji: string) => {
    if (!viewer) return
    const existing = rows.find(
      (r) => r.message_id === messageId && r.reactor_id === viewer.id && r.emoji === emoji,
    )

    if (existing) {
      // Optimistic removal — reacting is high-frequency and low-stakes, so it
      // should feel instant and simply restore itself if the write fails.
      const previous = rows
      setRows((prev) => prev.filter((r) => r.id !== existing.id))
      const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id)
      if (error) setRows(previous)
      return
    }

    // One reaction per person per message: the table's unique constraint is on
    // (message_id, scope, reactor_id), so picking a new emoji replaces the old.
    const previous = rows
    const optimistic: MessageReaction = {
      id: `optimistic-${messageId}-${emoji}`,
      message_id: messageId,
      scope,
      reactor_id: viewer.id,
      reactor_name: viewer.name,
      emoji,
      created_at: new Date().toISOString(),
    }
    setRows((prev) => [
      ...prev.filter((r) => !(r.message_id === messageId && r.reactor_id === viewer.id)),
      optimistic,
    ])

    const { data, error } = await supabase
      .from('message_reactions')
      .upsert(
        { message_id: messageId, scope, reactor_id: viewer.id, reactor_name: viewer.name, emoji },
        { onConflict: 'message_id,scope,reactor_id' },
      )
      .select()
      .single()

    if (error || !data) { setRows(previous); return }
    setRows((prev) => prev.map((r) => (r.id === optimistic.id ? (data as MessageReaction) : r)))
  }, [rows, scope, viewer])

  const byMessage = new Map<string, ReactionSummary[]>()
  for (const id of messageIds) {
    const mine = rows.filter((r) => r.message_id === id)
    if (mine.length > 0) byMessage.set(id, summariseReactions(mine, viewer?.id ?? null))
  }

  return { byMessage, toggle }
}
