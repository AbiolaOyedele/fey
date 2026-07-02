'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { Task, CreateTaskPayload, UpdateTaskPayload, TaskScope, Subtask, TaskFileRow } from '@/types/work-tasks'

interface UseTasksArgs {
  scope: TaskScope
  workspaceId: string | null | undefined
  projectId?: string | null
  contactId?: string | null
  /** undefined = active only (default), true = completed only */
  done?: boolean
}

/**
 * Loads and mutates tasks for a given scope via the /api/v1/tasks routes.
 * Mutations update local state optimistically and reconcile by refetch on error.
 */
export function useTasks({ scope, workspaceId, projectId, contactId, done }: UseTasksArgs) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('scope', scope)
    if (workspaceId) p.set('workspace_id', workspaceId)
    if (projectId) p.set('project_id', projectId)
    if (contactId) p.set('contact_id', contactId)
    if (done !== undefined) p.set('done', done ? 'true' : 'false')
    return p.toString()
  }, [scope, workspaceId, projectId, contactId, done])

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ tasks: Task[] }>(`/api/v1/tasks?${qs}`)
      setTasks(res.tasks)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [qs])

  useEffect(() => { void refetch() }, [refetch])

  const createTask = useCallback(async (payload: CreateTaskPayload) => {
    const { task } = await apiFetch<{ task: Task }>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({ ...payload, workspace_id: workspaceId }),
    })
    // A new active task only belongs in this list if it matches the done filter.
    if ((done ?? false) === task.done) setTasks((prev) => [...prev, task])
    return task
  }, [workspaceId, done])

  const patchTask = useCallback(async (id: string, updates: UpdateTaskPayload) => {
    const prev = tasks
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, ...updates } as Task : t)))
    try {
      const { task } = await apiFetch<{ task: Task }>(`/api/v1/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...updates, workspace_id: workspaceId }),
      })
      setTasks((cur) => cur.map((t) => (t.id === id ? task : t)))
      return task
    } catch (e) {
      setTasks(prev)
      throw e
    }
  }, [tasks, workspaceId])

  const toggleDone = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const nextDone = !task.done
    // It leaves this list once done-ness flips away from the active filter.
    setTasks((cur) => cur.filter((t) => t.id !== id))
    try {
      await apiFetch(`/api/v1/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ done: nextDone, workspace_id: workspaceId }) })
    } catch {
      await refetch()
    }
  }, [tasks, workspaceId, refetch])

  const deleteTask = useCallback(async (id: string) => {
    const prev = tasks
    setTasks((cur) => cur.filter((t) => t.id !== id))
    try {
      await apiFetch(`/api/v1/tasks/${id}`, { method: 'DELETE' })
    } catch (e) {
      setTasks(prev)
      throw e
    }
  }, [tasks])

  const moveToStage = useCallback(async (id: string, stageId: string) => {
    const prev = tasks
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, stage_id: stageId } : t)))
    try {
      await apiFetch(`/api/v1/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ stage_id: stageId, workspace_id: workspaceId }) })
    } catch {
      setTasks(prev)
    }
  }, [tasks, workspaceId])

  const setAssignees = useCallback(async (id: string, userIds: string[]) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/v1/tasks/${id}/assignees`, {
      method: 'PUT',
      body: JSON.stringify({ user_ids: userIds }),
    })
    setTasks((cur) => cur.map((t) => (t.id === id ? task : t)))
  }, [])

  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const task = tasks.find((t) => t.id === taskId)
    const sortOrder = task ? task.subtasks.length : 0
    const { subtask } = await apiFetch<{ subtask: Subtask }>(`/api/v1/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title, sort_order: sortOrder }),
    })
    setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t)))
  }, [tasks])

  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string, nextDone: boolean) => {
    setTasks((cur) => cur.map((t) => t.id === taskId
      ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: nextDone } : s)) }
      : t))
    try {
      await apiFetch(`/api/v1/subtasks/${subtaskId}`, { method: 'PATCH', body: JSON.stringify({ done: nextDone }) })
    } catch {
      await refetch()
    }
  }, [refetch])

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    setTasks((cur) => cur.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t))
    try {
      await apiFetch(`/api/v1/subtasks/${subtaskId}`, { method: 'DELETE' })
    } catch {
      await refetch()
    }
  }, [refetch])

  const addFile = useCallback(async (
    taskId: string,
    payload: { file_name: string; file_url: string; public_id: string; file_size?: number | null; file_type?: string | null },
  ) => {
    const { file } = await apiFetch<{ file: TaskFileRow }>(`/api/v1/tasks/${taskId}/files`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, files: [file, ...t.files] } : t)))
    return file
  }, [])

  const removeFile = useCallback(async (taskId: string, fileId: string) => {
    setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, files: t.files.filter((f) => f.id !== fileId) } : t)))
    try {
      // The API also removes the Cloudinary asset server-side (best-effort).
      await apiFetch(`/api/v1/tasks/${taskId}/files/${fileId}`, { method: 'DELETE' })
    } catch {
      await refetch()
    }
  }, [refetch])

  return {
    tasks, loading, error, refetch,
    createTask, patchTask, toggleDone, deleteTask, moveToStage, setAssignees,
    addSubtask, toggleSubtask, deleteSubtask,
    addFile, removeFile,
  }
}
