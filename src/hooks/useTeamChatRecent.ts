'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { InternalChannel, InternalMessage } from '@/types/team'

/** A recent internal message enriched with its channel name for the dashboard. */
export interface RecentTeamMessage extends InternalMessage {
  channel_name: string
}

/**
 * Loads the most recent internal-chat messages across every channel in the
 * workspace, newest first. Internal chat has no read-state model, so this powers
 * a "recent team activity" surface rather than an unread count. RLS already
 * restricts rows to workspaces the caller belongs to.
 */
export function useTeamChatRecent(workspaceId: string | null | undefined, limit = 4) {
  const [messages, setMessages] = useState<RecentTeamMessage[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!workspaceId) { setMessages([]); setLoading(false); return }
    setLoading(true)
    try {
      const [{ data: msgs }, { data: chans }] = await Promise.all([
        supabase
          .from('internal_messages')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('internal_channels')
          .select('id, name')
          .eq('workspace_id', workspaceId),
      ])
      const channelName = new Map<string, string>()
      for (const c of (chans ?? []) as Pick<InternalChannel, 'id' | 'name'>[]) channelName.set(c.id, c.name)
      setMessages(
        ((msgs ?? []) as InternalMessage[]).map((m) => ({
          ...m,
          // attachments can come back null from the DB; normalise so consumers
          // can safely read .length without a guard.
          attachments: m.attachments ?? [],
          channel_name: channelName.get(m.channel_id) ?? 'general',
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [workspaceId, limit])

  useEffect(() => { void refetch() }, [refetch])

  return { messages, loading, refetch }
}
