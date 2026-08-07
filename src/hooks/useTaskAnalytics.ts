'use client'

import { useState, useEffect, useCallback, useId, useMemo, useRef } from 'react'
import { apiFetch } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import type { AnalyticsFilter, AnalyticsRange, TaskAnalytics } from '@/types/task-analytics'

interface UseTaskAnalyticsArgs {
  workspaceId: string | null | undefined
  range: AnalyticsRange
  /** Narrows every number to one brand, client or teammate. */
  filter?: AnalyticsFilter | null
  /** Skip fetching until the panel is actually on screen. */
  enabled?: boolean
}

interface UseTaskAnalyticsState {
  data: TaskAnalytics | null
  /** True only until the first result lands. */
  loading: boolean
  /** True while a range or filter change is in flight, with the old numbers still up. */
  refreshing: boolean
  error: string | null
  refetch: () => void
}

const FILTER_PARAM: Record<AnalyticsFilter['kind'], string> = {
  brand: 'project_id',
  client: 'contact_id',
  person: 'assignee_id',
}

/**
 * Loads aggregated task activity for the insights panel.
 *
 * Changing the range or drilling into a brand refetches, but the previous
 * numbers stay on screen until the new ones land — a chart that empties itself
 * on every tap reads as broken rather than busy. Late responses for a query the
 * user has already moved on from are dropped rather than rendered.
 */
export function useTaskAnalytics({
  workspaceId, range, filter = null, enabled = true,
}: UseTaskAnalyticsArgs): UseTaskAnalyticsState {
  const [data, setData] = useState<TaskAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** The query string of the last request that finished, however it finished. */
  const [settled, setSettled] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('range', range)
    p.set('tz_offset', String(new Date().getTimezoneOffset()))
    if (workspaceId) p.set('workspace_id', workspaceId)
    if (filter && filter.id) p.set(FILTER_PARAM[filter.kind], filter.id)
    return p.toString()
  }, [range, workspaceId, filter])

  const inFlight = useRef(qs)

  const run = useCallback(async (key: string, silent: boolean) => {
    inFlight.current = key
    try {
      const res = await apiFetch<{ analytics: TaskAnalytics }>(`/api/v1/tasks/analytics?${key}`)
      if (inFlight.current !== key) return
      setData(res.analytics)
      setError(null)
    } catch (e) {
      if (inFlight.current !== key || silent) return
      setError(e instanceof Error ? e.message : 'Couldn’t load your task insights.')
    } finally {
      if (inFlight.current === key) setSettled(key)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void run(qs, false)
  }, [qs, enabled, run, retry])

  // Live updates: recompute quietly when tasks change anywhere this user can
  // see. Debounced hard — insights are a summary, not a ticker, and every
  // refresh recomputes a whole year of aggregates.
  const qsRef = useRef(qs)
  useEffect(() => { qsRef.current = qs }, [qs])
  // One channel per mounted panel — the dashboard card and the Insights tab can
  // both be listening, and Supabase needs the names to differ.
  const channelId = useId()
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const bump = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void run(qsRef.current, true) }, 2000)
    }
    const channel = supabase
      .channel(`task-analytics-live:${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_tasks' }, bump)
      .subscribe()
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel) }
  }, [enabled, channelId, run])

  const refetch = useCallback(() => setRetry((n) => n + 1), [])

  return {
    data,
    loading: settled === null && error === null,
    refreshing: settled !== null && settled !== qs,
    error,
    refetch,
  }
}
