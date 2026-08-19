'use client'

import { useState, useEffect, useCallback } from 'react'
import { env } from '@/config/env'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { portalBasePath } from '@/hooks/usePortalBase'
import { urlBase64ToUint8Array, type PushController } from '@/hooks/usePush'

/**
 * Web Push for a client portal, device by device.
 *
 * The same job as `usePushSubscription`, through a different door: portal users
 * aren't Supabase Auth users, so the subscription can't be written with the
 * Supabase client and goes to /api/v1/portal/push behind the portal JWT
 * instead.
 *
 * It also sends the base path this device reaches the portal on. A portal is
 * served at /client/* on the agency's subdomain and /portal/<slug>/* elsewhere,
 * and the server has no way to know which — so without this, a notification
 * would open a path that doesn't exist on the device that tapped it.
 */
export function usePortalPush(subdomain: string): PushController {
  const [supported, setSupported]   = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy]             = useState(false)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      !!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    // Reading what this browser and this install actually support IS
    // synchronising with an external system — none of it is derivable during
    // render, and it can't be a lazy initial value without risking a hydration
    // mismatch against the server, which has no navigator to ask.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok)
    if (!ok) return
    setPermission(Notification.permission)
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => undefined)
  }, [])

  const authHeaders = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [subdomain])

  const subscribe = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const headers = authHeaders()
      if (!headers) return

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
      })
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }

      const res = await fetch('/api/v1/portal/push', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          endpoint:   json.endpoint,
          keys:       json.keys,
          base_path:  portalBasePath(subdomain),
          user_agent: navigator.userAgent,
        }),
      })
      // A subscription the server didn't keep would leave the browser thinking
      // notifications are on while nothing can ever be delivered to it.
      if (!res.ok) { await sub.unsubscribe().catch(() => undefined); return }
      setSubscribed(true)
    } catch {
      /* dismissed, or transient — leave the state alone */
    } finally {
      setBusy(false)
    }
  }, [busy, authHeaders, subdomain])

  const unsubscribe = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        const headers = authHeaders()
        if (headers) {
          await fetch('/api/v1/portal/push', {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => undefined)
        }
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch {
      /* best-effort */
    } finally {
      setBusy(false)
    }
  }, [busy, authHeaders])

  return { supported, permission, subscribed, busy, subscribe, unsubscribe }
}
