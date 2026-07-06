'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api-client'
import { extractMentionedUserIds } from '@/utils/mentions'
import type { TaskComment } from '@/types/work-tasks'

interface TaskCommentsState {
  comments: TaskComment[]
  loading: boolean
  sending: boolean
  error: string | null
  addComment: (body: string) => Promise<void>
  editComment: (commentId: string, body: string) => Promise<void>
  deleteComment: (commentId: string) => Promise<void>
}

/**
 * Drives a single task's comment thread. Loads existing comments and streams
 * new/edited/deleted ones via Supabase Realtime (RLS scopes visibility to
 * whoever can already see the parent task — see 20260706_task_comments.sql).
 * Mirrors useInternalChat's realtime + optimistic-insert shape.
 */
export function useTaskComments(
  taskId: string | null,
  workspaceId: string | null | undefined,
  taskLink: string,
  taskTitle: string,
): TaskCommentsState {
  const { user } = useAuth()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) { setComments([]); setLoading(false); return }
    let cancelled = false

    void (async () => {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (err) { setError(err.message); setLoading(false); return }
      setComments((data ?? []) as TaskComment[])
      setLoading(false)
    })()

    const channel = supabase
      .channel(`task-comments:${taskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
        (payload) => {
          const c = payload.new as TaskComment
          setComments((prev) => prev.some((x) => x.id === c.id) ? prev : [...prev, c])
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
        (payload) => {
          const c = payload.new as TaskComment
          setComments((prev) => prev.map((x) => (x.id === c.id ? c : x)))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
        (payload) => {
          const deletedId = (payload.old as { id?: string }).id
          if (deletedId) setComments((prev) => prev.filter((x) => x.id !== deletedId))
        },
      )
      .subscribe()

    return () => { cancelled = true; void supabase.removeChannel(channel) }
  }, [taskId])

  const notifyMentions = useCallback((commentId: string, body: string) => {
    const userIds = extractMentionedUserIds(body)
    if (userIds.length === 0) return
    void apiFetch('/api/v1/mentions', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: workspaceId ?? null,
        entityType: 'task_comment',
        entityId: commentId,
        link: taskLink,
        contextLabel: taskTitle,
        userIds,
      }),
    }).catch(() => {})
  }, [workspaceId, taskLink, taskTitle])

  const addComment = useCallback(async (body: string) => {
    const trimmed = body.trim()
    if (!trimmed || !user || !taskId) return
    setSending(true)
    try {
      const { data, error: err } = await supabase
        .from('task_comments')
        .insert({ task_id: taskId, author_id: user.id, body: trimmed })
        .select()
        .single()
      if (err) throw err
      const comment = data as TaskComment
      setComments((prev) => prev.some((c) => c.id === comment.id) ? prev : [...prev, comment])
      setError(null)
      notifyMentions(comment.id, trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post comment')
    } finally {
      setSending(false)
    }
  }, [user, taskId, notifyMentions])

  const editComment = useCallback(async (commentId: string, body: string) => {
    const trimmed = body.trim()
    if (!trimmed) return
    const editedAt = new Date().toISOString()
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, body: trimmed, edited_at: editedAt } : c)))
    try {
      const { error: err } = await supabase
        .from('task_comments')
        .update({ body: trimmed, edited_at: editedAt })
        .eq('id', commentId)
      if (err) throw err
      notifyMentions(commentId, trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to edit comment')
    }
  }, [notifyMentions])

  const deleteComment = useCallback(async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    try {
      const { error: err } = await supabase.from('task_comments').delete().eq('id', commentId)
      if (err) throw err
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete comment')
    }
  }, [])

  return { comments, loading, sending, error, addComment, editComment, deleteComment }
}
