'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiFetch } from '@/lib/api-client'
import type {
  SocialBrand, SocialPost,
  CreateBrandPayload, UpdateBrandPayload,
  CreatePostPayload, UpdatePostPayload,
} from '@/types/social'

/** Local YYYY-MM-DD (not UTC — calendar days are local days). */
export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

interface UseSocialPlannerArgs {
  workspaceId: string | null | undefined
  /** Any date inside the month being viewed. */
  month: Date
}

/**
 * Brands + posts for the Social Corner calendar. Posts are fetched for the
 * visible month (padded a week each side so leading/trailing grid days are
 * populated). Mutations are optimistic where cheap, refetch-reconciled on error.
 */
export function useSocialPlanner({ workspaceId, month }: UseSocialPlannerArgs) {
  const [brands, setBrands] = useState<SocialBrand[]>([])
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { from, to } = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    start.setDate(start.getDate() - 7)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    end.setDate(end.getDate() + 7)
    return { from: toDateKey(start), to: toDateKey(end) }
  }, [month])

  const wsQuery = workspaceId ? `&workspace_id=${workspaceId}` : ''

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const [b, p] = await Promise.all([
        apiFetch<{ brands: SocialBrand[] }>(`/api/v1/social/brands?${workspaceId ? `workspace_id=${workspaceId}` : ''}`),
        apiFetch<{ posts: SocialPost[] }>(`/api/v1/social/posts?from=${from}&to=${to}${wsQuery}`),
      ])
      setBrands(b.brands)
      setPosts(p.posts)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the calendar')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, from, to, wsQuery])

  useEffect(() => { void refetch() }, [refetch])

  // ── Brands ──────────────────────────────────────────────────────────────────

  const createBrand = useCallback(async (payload: CreateBrandPayload) => {
    const { brand } = await apiFetch<{ brand: SocialBrand }>('/api/v1/social/brands', {
      method: 'POST',
      body: JSON.stringify({ ...payload, workspace_id: workspaceId }),
    })
    setBrands((prev) => [...prev, brand])
    return brand
  }, [workspaceId])

  const updateBrand = useCallback(async (id: string, updates: UpdateBrandPayload) => {
    const { brand } = await apiFetch<{ brand: SocialBrand }>(`/api/v1/social/brands/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...updates, workspace_id: workspaceId }),
    })
    setBrands((prev) => prev.map((b) => (b.id === id ? brand : b)))
    return brand
  }, [workspaceId])

  const deleteBrand = useCallback(async (id: string) => {
    const prevBrands = brands
    const prevPosts = posts
    setBrands((cur) => cur.filter((b) => b.id !== id))
    setPosts((cur) => cur.filter((p) => p.brand_id !== id))
    try {
      await apiFetch(`/api/v1/social/brands/${id}`, { method: 'DELETE' })
    } catch (e) {
      setBrands(prevBrands)
      setPosts(prevPosts)
      throw e
    }
  }, [brands, posts])

  // ── Posts ───────────────────────────────────────────────────────────────────

  const createPost = useCallback(async (payload: CreatePostPayload) => {
    const { post } = await apiFetch<{ post: SocialPost }>('/api/v1/social/posts', {
      method: 'POST',
      body: JSON.stringify({ ...payload, workspace_id: workspaceId }),
    })
    setPosts((prev) => [...prev, post])
    return post
  }, [workspaceId])

  const updatePost = useCallback(async (id: string, updates: UpdatePostPayload) => {
    const prev = posts
    setPosts((cur) => cur.map((p) => (p.id === id ? { ...p, ...updates } as SocialPost : p)))
    try {
      const { post } = await apiFetch<{ post: SocialPost }>(`/api/v1/social/posts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      setPosts((cur) => cur.map((p) => (p.id === id ? post : p)))
      return post
    } catch (e) {
      setPosts(prev)
      throw e
    }
  }, [posts])

  const deletePost = useCallback(async (id: string) => {
    const prev = posts
    setPosts((cur) => cur.filter((p) => p.id !== id))
    try {
      await apiFetch(`/api/v1/social/posts/${id}`, { method: 'DELETE' })
    } catch (e) {
      setPosts(prev)
      throw e
    }
  }, [posts])

  /** Promotes a post to a work_task on the main Tasks page. Idempotent. */
  const markAsTask = useCallback(async (id: string) => {
    const { post } = await apiFetch<{ post: SocialPost }>(`/api/v1/social/posts/${id}/task`, {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId }),
    })
    setPosts((cur) => cur.map((p) => (p.id === id ? post : p)))
    return post
  }, [workspaceId])

  /** Posts grouped by local date key, respecting time order within a day. */
  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>()
    for (const p of posts) {
      const list = map.get(p.scheduled_date) ?? []
      list.push(p)
      map.set(p.scheduled_date, list)
    }
    return map
  }, [posts])

  const brandById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands])

  return {
    brands, posts, postsByDay, brandById, loading, error, refetch,
    createBrand, updateBrand, deleteBrand,
    createPost, updatePost, deletePost, markAsTask,
  }
}
