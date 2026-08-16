'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { TaskHandoff } from '@/types/work-tasks'

/**
 * The chain of hands one task has passed through.
 *
 * Loaded on demand rather than with the task list: it's only ever read when
 * someone opens the task and asks "where did this actually stall", and it grows
 * with every move — carrying it on every row of the board would be dead weight.
 *
 * `reloadKey` re-fetches when the task changes hands under the drawer, so the
 * history doesn't sit one move behind the badge above it.
 */
export function useTaskHandoffs(taskId: string | null, reloadKey?: string) {
  const [handoffs, setHandoffs] = useState<TaskHandoff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!taskId) { setHandoffs([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await apiFetch<{ handoffs: TaskHandoff[] }>(`/api/v1/tasks/${taskId}/handoffs`)
      setHandoffs(res.handoffs)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load the history for this task.')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => { void load() }, [load, reloadKey])

  return { handoffs, loading, error, refetch: load }
}
