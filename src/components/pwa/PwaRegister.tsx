'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker (needed for installability + Web Push). Mounted
 * once in AppShell. The install prompt itself is left to the browser's native
 * UI / the user's "Add to Home Screen"; we just ensure the SW + manifest are live.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const onLoad = () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined) }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => window.removeEventListener('load', onLoad)
  }, [])
  return null
}
