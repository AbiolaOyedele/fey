'use client'

import { useState, useEffect, useCallback } from 'react'
import { env } from '@/config/env'

const POLL_INTERVAL_MS = 60_000

/**
 * Detects when a newer version of the app has been deployed.
 *
 * Compares the build id baked into this bundle (NEXT_PUBLIC_BUILD_ID, set at
 * build time from the commit SHA) against the SHA the live server reports at
 * /api/v1/version. When they differ, a new deploy is live and the user should
 * reload. Polls every 60s and whenever the tab regains focus.
 *
 * Returns false in local dev (no real build id), so the prompt never fires there.
 */
export function useUpdatePrompt(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const current = env.NEXT_PUBLIC_BUILD_ID ?? 'dev'

  const check = useCallback(async () => {
    if (current === 'dev') return // local/unknown build — nothing to compare against
    try {
      const res = await fetch('/api/v1/version', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { build?: string }
      if (data.build && data.build !== 'dev' && data.build !== current) {
        setUpdateAvailable(true)
      }
    } catch {
      /* offline or transient — try again on the next tick */
    }
  }, [current])

  useEffect(() => {
    if (updateAvailable) return // stop polling once we know
    void check()
    const id = setInterval(() => void check(), POLL_INTERVAL_MS)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [check, updateAvailable])

  return updateAvailable
}
