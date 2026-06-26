'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { AppNotification } from '@/types/notification'

/**
 * Recipient-based notifications for the signed-in user. Reads + realtime go
 * directly through Supabase (RLS: recipient_id = auth.uid()); creation is
 * server-side only. New rows arrive live via the realtime channel.
 */
export function useAppNotifications() {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // The hook can mount in several places at once (sidebar badge, bell, page).
  // Supabase reuses a channel by topic, so a shared topic would make the second
  // instance register `.on()` on an already-subscribed channel and throw. A
  // per-instance topic keeps every subscription independent.
  const instanceId = useRef<string>('')
  if (!instanceId.current) instanceId.current = Math.random().toString(36).slice(2)

  useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return }
    let active = true
    setLoading(true)
    void supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', uid)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (active) { setItems((data ?? []) as AppNotification[]); setLoading(false) } })

    const channel = supabase
      .channel(`notifications-${uid}-${instanceId.current}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` },
        (payload) => setItems((prev) => [payload.new as AppNotification, ...prev]),
      )
      .subscribe()
    channelRef.current = channel

    return () => { active = false; if (channelRef.current) void supabase.removeChannel(channelRef.current) }
  }, [uid])

  const unreadCount = items.filter((n) => !n.read_at).length

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!uid) return
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    await supabase.from('notifications').update({ read_at: now }).eq('recipient_id', uid).is('read_at', null)
  }, [uid])

  return { items, unreadCount, loading, markRead, markAllRead }
}
