'use client'

import { useEffect } from 'react'

const RELOAD_GUARD_KEY = 'fey:chunk_reload_at'
const RELOAD_GUARD_WINDOW_MS = 10_000

const CHUNK_ERROR_RE = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i

function isChunkAsset(url: string | undefined | null): boolean {
  return !!url && url.includes('/_next/static/')
}

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? '0')
    if (Date.now() - last < RELOAD_GUARD_WINDOW_MS) return // already tried recently — don't loop
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch { /* sessionStorage unavailable — reload anyway, worst case is one extra reload */ }
  window.location.reload()
}

/**
 * Installed PWAs can stay open across a deploy. When that happens, Next's
 * router tries to lazy-load a JS chunk that belonged to the OLD build — the
 * file no longer exists once a newer deploy has replaced it, so the fetch
 * just fails. That happens inside Next's own module loader, before any of our
 * error boundaries get a chance to render, so the browser shows its native
 * "this page couldn't load" fallback instead of the app.
 *
 * Rather than ask every user to notice a banner and manually refresh, detect
 * the failure directly (both the script/module-script error event and the
 * unhandled promise rejection Next throws for it) and reload once,
 * automatically. The sessionStorage guard stops a reload loop if the server
 * is genuinely down rather than just stale.
 */
export function useChunkErrorReload() {
  useEffect(() => {
    const onError = (event: ErrorEvent | Event) => {
      const target = event.target as (HTMLScriptElement | HTMLLinkElement | null)
      const url = target ? ((target as HTMLScriptElement).src ?? (target as HTMLLinkElement).href) : null
      if (target && isChunkAsset(url)) { reloadOnce(); return }
      const message = (event as ErrorEvent).message
      if (message && CHUNK_ERROR_RE.test(message)) reloadOnce()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const name = reason?.name ?? ''
      const message = reason?.message ?? String(reason ?? '')
      if (name === 'ChunkLoadError' || CHUNK_ERROR_RE.test(message)) reloadOnce()
    }
    window.addEventListener('error', onError, true) // capture phase — resource errors don't bubble
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}
