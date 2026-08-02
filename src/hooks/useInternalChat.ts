'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api-client'
import { extractMentionedUserIds } from '@/utils/mentions'
import type { InternalChannel, InternalMessage } from '@/types/team'
import type { MessageAttachment } from '@/types/crm'

interface InternalChatState {
  channels:        InternalChannel[]
  activeChannelId: string | null
  setActiveChannel: (id: string) => void
  messages:        InternalMessage[]
  loadingChannels: boolean
  loadingMessages: boolean
  sending:         boolean
  error:           string | null
  send:            (body: string, attachments?: MessageAttachment[], replyToId?: string | null) => Promise<void>
  editMessage:     (messageId: string, body: string) => Promise<void>
  deleteMessage:   (messageId: string) => Promise<void>
  /** Hide for yourself only — everyone else keeps seeing it. */
  hideMessage:     (messageId: string) => Promise<void>
  createChannel:   (name: string) => Promise<void>
}

/**
 * Drives the Internal Chats (Playground). Loads the workspace's channels,
 * streams messages for the active channel via Supabase Realtime, and sends new
 * messages. RLS restricts every query to channels in workspaces the user belongs
 * to, so no workspace filter is needed client-side.
 */
export function useInternalChat(workspaceId: string | null): InternalChatState {
  const { user } = useAuth()
  const [channels,        setChannels]        = useState<InternalChannel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [messages,        setMessages]        = useState<InternalMessage[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending,         setSending]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const activeRef = useRef<string | null>(null)

  // Load channels for the workspace.
  useEffect(() => {
    if (!workspaceId) { setLoadingChannels(false); return }
    let cancelled = false
    void (async () => {
      setLoadingChannels(true)
      const { data, error: err } = await supabase
        .from('internal_channels')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (err) { setError(err.message); setLoadingChannels(false); return }
      const list = (data ?? []) as InternalChannel[]
      setChannels(list)
      setActiveChannelId((prev) => prev ?? list[0]?.id ?? null)
      setLoadingChannels(false)
    })()
    return () => { cancelled = true }
  }, [workspaceId])

  // Load + subscribe to messages for the active channel.
  useEffect(() => {
    activeRef.current = activeChannelId
    if (!activeChannelId) { setMessages([]); return }
    let cancelled = false

    void (async () => {
      setLoadingMessages(true)
      // "Delete for me" is per-viewer, so it can't live on the message row —
      // the hides are fetched alongside and applied here. Without this the
      // message would reappear on the next refresh.
      const [{ data, error: err }, { data: hiddenRows }] = await Promise.all([
        supabase
          .from('internal_messages')
          .select('*')
          .eq('channel_id', activeChannelId)
          .order('created_at', { ascending: true })
          .limit(200),
        supabase
          .from('message_hidden')
          .select('message_id')
          .eq('scope', 'internal'),
      ])
      if (cancelled) return
      if (err) { setError(err.message); setLoadingMessages(false); return }
      // RLS already scopes message_hidden to this viewer.
      const hidden = new Set((hiddenRows ?? []).map((r) => (r as { message_id: string }).message_id))
      setMessages(((data ?? []) as InternalMessage[]).filter((m) => !hidden.has(m.id)))
      setLoadingMessages(false)
    })()

    const channel = supabase
      .channel(`internal:${activeChannelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'internal_messages', filter: `channel_id=eq.${activeChannelId}` },
        (payload) => {
          const msg = payload.new as InternalMessage
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'internal_messages', filter: `channel_id=eq.${activeChannelId}` },
        (payload) => {
          const msg = payload.new as InternalMessage
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'internal_messages', filter: `channel_id=eq.${activeChannelId}` },
        (payload) => {
          const deletedId = (payload.old as { id?: string }).id
          if (deletedId) setMessages((prev) => prev.filter((m) => m.id !== deletedId))
        },
      )
      .subscribe()

    return () => { cancelled = true; void supabase.removeChannel(channel) }
  }, [activeChannelId])

  const send = useCallback(async (body: string, attachments: MessageAttachment[] = [], replyToId: string | null = null) => {
    const trimmed = body.trim()
    if ((!trimmed && attachments.length === 0) || !user || !workspaceId || !activeChannelId) return
    setSending(true)
    try {
      // Only include attachments when present so text chat keeps working even
      // before the attachments column migration is applied.
      const payload: Record<string, unknown> = {
        channel_id:   activeChannelId,
        workspace_id: workspaceId,
        sender_id:    user.id,
        body:         trimmed,
      }
      if (attachments.length > 0) payload.attachments = attachments
      // Only set when replying, so a plain send doesn't depend on the column
      // existing in an environment that hasn't run the migration yet.
      if (replyToId) payload.reply_to_id = replyToId
      const { data, error: err } = await supabase
        .from('internal_messages')
        .insert(payload)
        .select()
        .single()
      if (err) throw err
      // Optimistically append (realtime echo is de-duped by id).
      const msg = data as InternalMessage
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
      setError(null)

      const mentionedIds = extractMentionedUserIds(trimmed)
      if (mentionedIds.length > 0) {
        const channelName = channels.find((c) => c.id === activeChannelId)?.name ?? 'general'
        void apiFetch('/api/v1/mentions', {
          method: 'POST',
          body: JSON.stringify({
            workspaceId,
            entityType: 'internal_message',
            entityId: msg.id,
            link: `/chats?channel=${activeChannelId}&message=${msg.id}`,
            contextLabel: `#${channelName}`,
            userIds: mentionedIds,
          }),
        }).catch(() => {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }, [user, workspaceId, activeChannelId, channels])

  const editMessage = useCallback(async (messageId: string, body: string) => {
    const trimmed = body.trim()
    if (!trimmed) return
    const editedAt = new Date().toISOString()
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, body: trimmed, edited_at: editedAt } : m)))
    try {
      const { error: err } = await supabase
        .from('internal_messages')
        .update({ body: trimmed, edited_at: editedAt })
        .eq('id', messageId)
      if (err) throw err

      const mentionedIds = extractMentionedUserIds(trimmed)
      if (mentionedIds.length > 0 && workspaceId && activeChannelId) {
        const channelName = channels.find((c) => c.id === activeChannelId)?.name ?? 'general'
        void apiFetch('/api/v1/mentions', {
          method: 'POST',
          body: JSON.stringify({
            workspaceId,
            entityType: 'internal_message',
            entityId: messageId,
            link: `/chats?channel=${activeChannelId}&message=${messageId}`,
            contextLabel: `#${channelName}`,
            userIds: mentionedIds,
          }),
        }).catch(() => {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to edit message')
    }
  }, [workspaceId, activeChannelId, channels])

  /**
   * Unsend for everyone — a soft delete, the way WhatsApp does it.
   *
   * This used to hard-DELETE the row, which is the one thing WhatsApp doesn't
   * do: the message vanished and the thread silently closed up, so nobody could
   * tell a message had been removed rather than never sent, and any reply
   * quoting it lost its parent. The row now stays as a tombstone and renders as
   * "This message was deleted".
   */
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return
    const deletedAt = new Date().toISOString()
    const previous = messages
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, body: '', attachments: [], deleted_at: deletedAt, deleted_by: user.id }
          : m,
      ),
    )
    try {
      const { error: err } = await supabase
        .from('internal_messages')
        // The body is cleared as well as tombstoned: leaving the text in the row
        // would keep it readable to anyone who can query the table.
        .update({ body: '', attachments: [], deleted_at: deletedAt, deleted_by: user.id })
        .eq('id', messageId)
      if (err) throw err
    } catch (e) {
      setMessages(previous)
      setError(e instanceof Error ? e.message : 'Failed to delete message')
    }
  }, [user, messages])

  /** Hide a message for yourself only — everyone else still sees it. */
  const hideMessage = useCallback(async (messageId: string) => {
    if (!user) return
    const previous = messages
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    try {
      const { error: err } = await supabase
        .from('message_hidden')
        .upsert(
          { message_id: messageId, scope: 'internal', viewer_id: user.id },
          { onConflict: 'message_id,scope,viewer_id' },
        )
      if (err) throw err
    } catch (e) {
      setMessages(previous)
      setError(e instanceof Error ? e.message : 'Failed to hide message')
    }
  }, [user, messages])

  const createChannel = useCallback(async (name: string) => {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
    if (!clean || !user || !workspaceId) return
    const { data, error: err } = await supabase
      .from('internal_channels')
      .insert({ workspace_id: workspaceId, name: clean, created_by: user.id })
      .select()
      .single()
    if (err) { setError(err.message); return }
    const ch = data as InternalChannel
    setChannels((prev) => [...prev, ch])
    setActiveChannelId(ch.id)
  }, [user, workspaceId])

  return {
    channels, activeChannelId, setActiveChannel: setActiveChannelId,
    messages, loadingChannels, loadingMessages, sending, error, send, editMessage, deleteMessage, hideMessage, createChannel,
  }
}
