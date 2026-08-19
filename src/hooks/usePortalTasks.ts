'use client'

import { useCallback, useEffect, useState } from 'react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import type { Task, UpdateTaskPayload, WorkflowStage } from '@/types/work-tasks'

/**
 * The client's tasks, in the shape the app's task components expect.
 *
 * This exists so the portal reuses `TaskListView`, `TaskDetailDrawer` and
 * `NewTaskModal` verbatim rather than growing a parallel, worse copy. Those
 * components take callbacks, so the only thing that differs between the two
 * sides is which endpoints those callbacks hit — everything the client sees is
 * then identical to the app by construction.
 */
/** A brand as the task sheet needs it — just enough to label an option. */
export interface PortalBrandOption {
  id: string
  title: string
}

export interface PortalTasksState {
  tasks: Task[]
  stages: WorkflowStage[]
  /** The client's brands, for filing a new task under one. */
  brands: PortalBrandOption[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createTask: (payload: Record<string, unknown>) => Promise<Task>
  patchTask: (id: string, updates: UpdateTaskPayload) => Promise<Task | void>
  /** Only tasks the client raised; the API rejects anything else. */
  deleteTask: (id: string) => Promise<void>
  toggleDone: (id: string) => Promise<void>
  setAssignees: (id: string, ids: string[]) => Promise<void>
  addSubtask: (taskId: string, title: string) => Promise<void>
  toggleSubtask: (taskId: string, subtaskId: string, done: boolean) => Promise<void>
  renameSubtask: (taskId: string, subtaskId: string, title: string) => Promise<void>
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>
  addFile: (taskId: string, payload: {
    file_name: string; file_url: string; public_id: string
    file_size?: number | null; file_type?: string | null
  }) => Promise<unknown>
  removeFile: (taskId: string, fileId: string) => Promise<void>
}

export function usePortalTasks(subdomain: string): PortalTasksState {
  const [tasks, setTasks]     = useState<Task[]>([])
  const [stages, setStages]   = useState<WorkflowStage[]>([])
  const [brands, setBrands]   = useState<PortalBrandOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const headers = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [subdomain])

  const refetch = useCallback(async () => {
    const h = headers()
    if (!h) { setLoading(false); return }
    try {
      const res = await fetch('/api/v1/portal/tasks', { headers: h })
      if (!res.ok) throw new Error('load failed')
      const d = await res.json() as { tasks: Task[]; stages: WorkflowStage[]; brands?: PortalBrandOption[] }
      setTasks(d.tasks)
      setStages(d.stages ?? [])
      setBrands(d.brands ?? [])
      setError(null)
    } catch {
      setError('Couldn’t load your tasks. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    // Loading a list IS synchronising with an external system; the rule fires
    // only because the fetch starts synchronously rather than from a callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch()
  }, [refetch])

  const send = useCallback(async (path: string, init: RequestInit): Promise<unknown> => {
    const h = headers()
    if (!h) throw new Error('You’ve been signed out. Please sign in again.')
    const res = await fetch(path, { ...init, headers: h })
    if (!res.ok) {
      const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
      throw new Error(d?.error?.message ?? 'That change couldn’t be saved.')
    }
    return res.json().catch(() => null)
  }, [headers])

  const applyTask = useCallback((task: Task) => {
    setTasks((prev) => (prev.some((t) => t.id === task.id)
      ? prev.map((t) => (t.id === task.id ? task : t))
      : [...prev, task]))
  }, [])

  const createTask = useCallback(async (payload: Record<string, unknown>): Promise<Task> => {
    const d = await send('/api/v1/portal/tasks', { method: 'POST', body: JSON.stringify(payload) }) as { task: Task }
    applyTask(d.task)
    return d.task
  }, [send, applyTask])

  const patchTask = useCallback(async (id: string, updates: UpdateTaskPayload) => {
    const d = await send(`/api/v1/portal/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }) as { task: Task }
    applyTask(d.task)
    return d.task
  }, [send, applyTask])

  const deleteTask = useCallback(async (id: string) => {
    const previous = tasks
    // Removed from the list first: the drawer closes onto whatever is behind it,
    // and a row that lingers for a round-trip reads as a failed delete.
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      await send(`/api/v1/portal/tasks/${id}`, { method: 'DELETE' })
    } catch (e) {
      setTasks(previous)
      throw e
    }
  }, [send, tasks])

  const toggleDone = useCallback(async (id: string) => {
    const current = tasks.find((t) => t.id === id)
    if (!current) return
    await patchTask(id, { done: !current.done })
  }, [tasks, patchTask])

  const setAssignees = useCallback(async (id: string, ids: string[]) => {
    await patchTask(id, { assignee_ids: ids } as UpdateTaskPayload)
  }, [patchTask])

  // Subtasks and files have no single-row response worth threading back, so they
  // refetch — rare actions where correctness beats a saved request.
  const addSubtask = useCallback(async (taskId: string, title: string) => {
    await send(`/api/v1/portal/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) })
    await refetch()
  }, [send, refetch])

  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string, done: boolean) => {
    await send(`/api/v1/portal/tasks/${taskId}/subtasks`, { method: 'PATCH', body: JSON.stringify({ subtask_id: subtaskId, done }) })
    await refetch()
  }, [send, refetch])

  const renameSubtask = useCallback(async (taskId: string, subtaskId: string, title: string) => {
    await send(`/api/v1/portal/tasks/${taskId}/subtasks`, { method: 'PATCH', body: JSON.stringify({ subtask_id: subtaskId, title }) })
    await refetch()
  }, [send, refetch])

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    await send(`/api/v1/portal/tasks/${taskId}/subtasks?id=${encodeURIComponent(subtaskId)}`, { method: 'DELETE' })
    await refetch()
  }, [send, refetch])

  const addFile = useCallback(async (taskId: string, payload: {
    file_name: string; file_url: string; public_id: string
    file_size?: number | null; file_type?: string | null
  }) => {
    await send(`/api/v1/portal/tasks/${taskId}/files`, { method: 'POST', body: JSON.stringify(payload) })
    await refetch()
    return null
  }, [send, refetch])

  const removeFile = useCallback(async (taskId: string, fileId: string) => {
    await send(`/api/v1/portal/tasks/${taskId}/files?id=${encodeURIComponent(fileId)}`, { method: 'DELETE' })
    await refetch()
  }, [send, refetch])

  return {
    tasks, stages, brands, loading, error, refetch,
    createTask, patchTask, deleteTask, toggleDone, setAssignees,
    addSubtask, toggleSubtask, renameSubtask, deleteSubtask, addFile, removeFile,
  }
}
