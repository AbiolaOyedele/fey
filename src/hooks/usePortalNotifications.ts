'use client'

import { useCallback, useEffect, useState } from 'react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import type { ListPortalNotificationsResponse, PortalNotification } from '@/types/portal-notification'

/**
 * The client's notification feed.
 *
 * Portal users authenticate with a custom JWT held in localStorage rather than
 * a Supabase session, so this can't use the Realtime subscription the owner's
 * app uses (Realtime authorises off Supabase auth). It polls instead — cheap
 * for a feed this small, and it keeps working when a tab is restored from the
 * background, which a dropped socket would not.
 */

const POLL_MS = 60_000

interface State {
  notifications: PortalNotification[]
  unread: number
  loading: boolean
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export function usePortalNotifications(subdomain: string): State {
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const authHeaders = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [subdomain])

  const refresh = useCallback(async () => {
    const headers = authHeaders()
    if (!headers) { setLoading(false); return }
    try {
      const res = await fetch('/api/v1/portal/notifications', { headers })
      if (!res.ok) return
      const data = (await res.json()) as ListPortalNotificationsResponse
      setNotifications(data.notifications)
      setUnread(data.unread)
    } catch {
      /* a failed poll just leaves the last good state on screen */
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  // Fetching a feed IS synchronising with an external system, which is what an
  // effect is for; the rule fires only because the first fetch is kicked off
  // synchronously rather than from a subscription callback.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  // Optimistic on both — the row is already marked locally, and the next poll
  // reconciles if the request failed.
  const markRead = useCallback(async (id: string) => {
    const headers = authHeaders()
    if (!headers) return
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n)))
    setUnread((u) => Math.max(0, u - 1))
    await fetch('/api/v1/portal/notifications', { method: 'PATCH', headers, body: JSON.stringify({ id }) })
      .catch(() => undefined)
  }, [authHeaders])

  const markAllRead = useCallback(async () => {
    const headers = authHeaders()
    if (!headers) return
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    setUnread(0)
    await fetch('/api/v1/portal/notifications', { method: 'PATCH', headers, body: JSON.stringify({}) })
      .catch(() => undefined)
  }, [authHeaders])

  return { notifications, unread, loading, refresh, markRead, markAllRead }
}
