'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { env } from '@/config/env'

/** Web Push subscription management for the current device. */
export function usePushSubscription() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      !!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    setSupported(ok)
    if (!ok) return
    setPermission(Notification.permission)
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => undefined)
  }, [])

  const subscribe = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase.from('push_subscriptions').upsert(
        { user_id: session.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent },
        { onConflict: 'endpoint' },
      )
      setSubscribed(true)
    } catch {
      /* user dismissed or transient — leave state as-is */
    } finally {
      setBusy(false)
    }
  }, [busy])

  const unsubscribe = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch {
      /* best-effort */
    } finally {
      setBusy(false)
    }
  }, [busy])

  return { supported, permission, subscribed, busy, subscribe, unsubscribe }
}

/** VAPID public key (base64url) → Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
