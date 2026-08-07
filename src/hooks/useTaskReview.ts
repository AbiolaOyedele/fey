'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import type {
  CreateReviewCommentPayload, CreateReviewVersionPayload, ReviewComment, ReviewVersion,
} from '@/types/task-review'

/**
 * Version history for a task's deliverable, for either side of the portal.
 *
 * `subdomain` decides which endpoints are used: absent means the app (Supabase
 * bearer token), present means a portal client (their own JWT). The shapes
 * returned are identical, so the panel above doesn't know or care which it got —
 * the same arrangement TaskDetailDrawer already uses for tasks themselves.
 */
export interface TaskReviewState {
  versions: ReviewVersion[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  addVersion: (payload: CreateReviewVersionPayload) => Promise<void>
  addComment: (reviewId: string, payload: CreateReviewCommentPayload) => Promise<void>
  /** Versions removed by the three-version cap on the last upload, if any. */
  lastPruned: number[]
}

interface UseTaskReviewArgs {
  taskId: string
  /** Set when running inside a client portal. */
  subdomain?: string | undefined
  /** Skip loading until the Review tab is actually opened. */
  enabled?: boolean
}

export function useTaskReview({ taskId, subdomain, enabled = true }: UseTaskReviewArgs): TaskReviewState {
  const [versions, setVersions] = useState<ReviewVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastPruned, setLastPruned] = useState<number[]>([])

  const isPortal = !!subdomain
  const base = isPortal
    ? `/api/v1/portal/tasks/${taskId}/reviews`
    : `/api/v1/tasks/${taskId}/reviews`

  /** Portal calls carry the client's own JWT; app calls go through apiFetch. */
  const call = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!isPortal) return apiFetch<T>(path, init)
    const token = localStorage.getItem(portalTokenKey(subdomain!))
    if (!token) throw new Error('Your session has expired. Please sign in again.')
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (init?.body) headers.set('Content-Type', 'application/json')
    const res = await fetch(path, { ...init, headers })
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new Error(b?.error?.message ?? 'Something went wrong. Please try again.')
    }
    return res.json() as Promise<T>
  }, [isPortal, subdomain])

  const refetch = useCallback(async () => {
    try {
      const { versions: v } = await call<{ versions: ReviewVersion[] }>(base)
      setVersions(v)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t load the review history.')
    } finally {
      setLoading(false)
    }
  }, [base, call])

  useEffect(() => {
    if (!enabled) return
    void refetch()
  }, [refetch, enabled])

  const addVersion = useCallback(async (payload: CreateReviewVersionPayload) => {
    const { pruned } = await call<{ version: ReviewVersion; pruned: number[] }>(base, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setLastPruned(pruned)
    // Refetched rather than pushed: the upload supersedes earlier versions and
    // may prune one, so the whole list changed, not just its head.
    await refetch()
  }, [base, call, refetch])

  const addComment = useCallback(async (reviewId: string, payload: CreateReviewCommentPayload) => {
    const { comment } = await call<{ comment: ReviewComment }>(`${base}/${reviewId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setVersions((cur) => cur.map((v) => (
      v.id === reviewId
        ? {
          ...v,
          comments: [...v.comments, comment],
          // Mirror the ruling the server just applied, so the badge updates
          // without waiting for a refetch.
          status: payload.decision ?? v.status,
        }
        : v
    )))
  }, [base, call])

  return { versions, loading, error, refetch, addVersion, addComment, lastPruned }
}
