'use client'

import { useCallback, useEffect, useState } from 'react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import type { AnalyticsRange, TaskAnalytics } from '@/types/task-analytics'

export interface PortalAnalyticsState {
  data: TaskAnalytics | null
  loading: boolean
  /** True while a range change is in flight, with the old numbers still up. */
  refreshing: boolean
  error: string | null
  /**
   * The owner hasn't switched Progress on for this client. Not an error to
   * apologise for — the panel simply isn't offered, so the tab hides itself.
   */
  unavailable: boolean
  refetch: () => void
}

/**
 * The client's own delivery numbers for the portal Progress panel.
 *
 * Sends no ids — the endpoint takes its scope from the portal token, so there
 * is nothing here a client could tamper with to see another workspace.
 */
export function usePortalTaskAnalytics(subdomain: string, range: AnalyticsRange): PortalAnalyticsState {
  const [data, setData] = useState<TaskAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [settled, setSettled] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  const key = `${range}:${new Date().getTimezoneOffset()}`

  const run = useCallback(async (k: string, r: AnalyticsRange) => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    if (!token) { setSettled(k); return }
    try {
      const qs = new URLSearchParams({ range: r, tz_offset: String(new Date().getTimezoneOffset()) })
      const res = await fetch(`/api/v1/portal/tasks/analytics?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) { setUnavailable(true); setError(null); return }
      if (!res.ok) throw new Error('load failed')
      const d = await res.json() as { analytics: TaskAnalytics }
      setData(d.analytics)
      setUnavailable(false)
      setError(null)
    } catch {
      setError('We couldn’t load your progress just now.')
    } finally {
      setSettled(k)
    }
  }, [subdomain])

  useEffect(() => { void run(key, range) }, [run, key, range, retry])

  const refetch = useCallback(() => setRetry((n) => n + 1), [])

  return {
    data,
    loading: settled === null && error === null && !unavailable,
    refreshing: settled !== null && settled !== key,
    error,
    unavailable,
    refetch,
  }
}
