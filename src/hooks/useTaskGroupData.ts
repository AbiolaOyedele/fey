'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { IS_DEMO } from '@/lib/constants'
import { getNextSortOrder } from '@/utils/sortOrder'
import type { TaskGroup, StandaloneTask } from '@/types'

function transformGroups(
  groups: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
): TaskGroup[] {
  return groups.map((g) => ({
    id: g.id as string,
    name: g.name as string,
    color: g.color as string,
    icon: (g.icon as string) || '',
    sort_order: (g.sort_order as number) ?? 0,
    createdAt: g.created_at as string,
    tasks: tasks
      .filter((t) => t.task_group_id === g.id)
      .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
      .map((t) => ({
        id: t.id as string,
        title: t.title as string,
        done: t.done as boolean,
        deadline: (t.deadline as string | null) || null,
        sort_order: (t.sort_order as number) ?? 0,
        createdAt: t.created_at as string,
      }) satisfies StandaloneTask),
  }))
}

export function useTaskGroupData(userId: string | undefined) {
  const [groups,          setGroups]          = useState<TaskGroup[]>([])
  const [standaloneTasks, setStandaloneTasks] = useState<StandaloneTask[]>([])
  const [loading,         setLoading]         = useState(!IS_DEMO)
  const [error,           setError]           = useState<string | null>(null)
  const groupsRef    = useRef<TaskGroup[]>([])
  const standaloneRef = useRef<StandaloneTask[]>([])

  useEffect(() => { groupsRef.current    = groups          }, [groups])
  useEffect(() => { standaloneRef.current = standaloneTasks }, [standaloneTasks])

  const fetchData = useCallback(async () => {
    if (IS_DEMO) return
    if (!userId) return
    try {
      const [groupsRes, tasksRes] = await Promise.all([
        supabase.from('task_groups').select('*').eq('user_id', userId).eq('app', 'fey').order('sort_order', { ascending: true }).order('created_at'),
        supabase.from('standalone_tasks').select('*').eq('user_id', userId).eq('app', 'fey').order('sort_order', { ascending: true }).order('created_at'),
      ])
      if (groupsRes.error) throw groupsRes.error
      if (tasksRes.error) throw tasksRes.error

      const allTasks = (tasksRes.data || []) as Record<string, unknown>[]
      const groupTasks = allTasks.filter((t) => t.task_group_id !== null)
      const solo       = allTasks.filter((t) => t.task_group_id === null)

      setGroups(transformGroups((groupsRes.data || []) as Record<string, unknown>[], groupTasks))
      setStandaloneTasks(solo.map((t) => ({
        id: t.id as string,
        title: t.title as string,
        done: t.done as boolean,
        deadline: (t.deadline as string | null) || null,
        sort_order: (t.sort_order as number) ?? 0,
        createdAt: t.created_at as string,
      })))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void fetchData() }, [fetchData])

  // ── Groups ──────────────────────────────────────────────────────────────────

  const addGroup = useCallback(async (name: string, color: string, icon = '') => {
    if (IS_DEMO || !userId) return
    const maxSort = getNextSortOrder(groupsRef.current)
    const { data, error: err } = await supabase
      .from('task_groups')
      .insert({ name, color, icon, sort_order: maxSort, user_id: userId, app: 'fey' })
      .select().single()
    if (err) { setError(err.message); return }
    const row = data as Record<string, unknown>
    setGroups((prev) => [...prev, {
      id: row.id as string, name: row.name as string, color: row.color as string,
      icon: (row.icon as string) || '', sort_order: (row.sort_order as number) ?? 0,
      createdAt: row.created_at as string, tasks: [],
    }])
  }, [userId])

  const updateGroup = useCallback(async (groupId: string, updates: Partial<TaskGroup>) => {
    if (IS_DEMO || !userId) return
    const dbUpdates: Partial<TaskGroup> = {}
    if ('name'  in updates) dbUpdates.name  = updates.name
    if ('color' in updates) dbUpdates.color = updates.color
    if ('icon'  in updates) dbUpdates.icon  = updates.icon
    const { error: err } = await supabase.from('task_groups').update(dbUpdates).eq('id', groupId).eq('user_id', userId)
    if (err) { setError(err.message); return }
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, ...updates } : g))
  }, [userId])

  const removeGroup = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId))
  }, [])

  const reorderGroups = useCallback(async (orderedIds: string[]) => {
    if (IS_DEMO || !userId) return
    setGroups((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]))
      return orderedIds.map((id, i) => ({ ...map.get(id)!, sort_order: i }))
    })
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('task_groups').update({ sort_order: i }).eq('id', id).eq('user_id', userId)
    ))
  }, [userId])

  // ── Standalone tasks ────────────────────────────────────────────────────────

  const addStandaloneTask = useCallback(async (title: string) => {
    if (IS_DEMO || !userId) return
    const maxSort = getNextSortOrder(standaloneRef.current)
    const { data, error: err } = await supabase
      .from('standalone_tasks')
      .insert({ title, done: false, task_group_id: null, sort_order: maxSort, user_id: userId, app: 'fey' })
      .select().single()
    if (err) { setError(err.message); return }
    const row = data as Record<string, unknown>
    setStandaloneTasks((prev) => [...prev, {
      id: row.id as string, title: row.title as string, done: row.done as boolean,
      deadline: (row.deadline as string | null) || null,
      sort_order: (row.sort_order as number) ?? 0, createdAt: row.created_at as string,
    }])
  }, [userId])

  const updateStandaloneTask = useCallback(async (taskId: string, updates: Partial<StandaloneTask>) => {
    if (IS_DEMO || !userId) return
    const dbUpdates: Partial<StandaloneTask> = {}
    if ('title'      in updates) dbUpdates.title      = updates.title
    if ('done'       in updates) dbUpdates.done       = updates.done
    if ('deadline'   in updates) dbUpdates.deadline   = updates.deadline
    if ('sort_order' in updates) dbUpdates.sort_order = updates.sort_order
    const { error: err } = await supabase.from('standalone_tasks').update(dbUpdates).eq('id', taskId).eq('user_id', userId)
    if (err) { setError(err.message); return }
    setStandaloneTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t))
  }, [userId])

  const removeStandaloneTask = useCallback((taskId: string) => {
    setStandaloneTasks((prev) => prev.filter((t) => t.id !== taskId))
  }, [])

  const reorderStandaloneTasks = useCallback(async (orderedIds: string[]) => {
    if (IS_DEMO || !userId) return
    setStandaloneTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]))
      return orderedIds.map((id, i) => ({ ...map.get(id)!, sort_order: i }))
    })
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('standalone_tasks').update({ sort_order: i }).eq('id', id).eq('user_id', userId)
    ))
  }, [userId])

  // ── Group tasks ─────────────────────────────────────────────────────────────

  const addGroupTask = useCallback(async (groupId: string, title: string) => {
    if (IS_DEMO || !userId) return
    const group   = groupsRef.current.find((g) => g.id === groupId)
    const maxSort = getNextSortOrder(group?.tasks ?? [])
    const { data, error: err } = await supabase
      .from('standalone_tasks')
      .insert({ title, done: false, task_group_id: groupId, sort_order: maxSort, user_id: userId, app: 'fey' })
      .select().single()
    if (err) { setError(err.message); return }
    const row = data as Record<string, unknown>
    const newTask: StandaloneTask = {
      id: row.id as string, title: row.title as string, done: row.done as boolean,
      deadline: (row.deadline as string | null) || null,
      sort_order: (row.sort_order as number) ?? 0, createdAt: row.created_at as string,
    }
    setGroups((prev) => prev.map((g) =>
      g.id === groupId ? { ...g, tasks: [...g.tasks, newTask] } : g
    ))
  }, [userId])

  const updateGroupTask = useCallback(async (groupId: string, taskId: string, updates: Partial<StandaloneTask>) => {
    if (IS_DEMO || !userId) return
    const dbUpdates: Partial<StandaloneTask> = {}
    if ('title'    in updates) dbUpdates.title    = updates.title
    if ('done'     in updates) dbUpdates.done     = updates.done
    if ('deadline' in updates) dbUpdates.deadline = updates.deadline
    const { error: err } = await supabase.from('standalone_tasks').update(dbUpdates).eq('id', taskId).eq('user_id', userId)
    if (err) { setError(err.message); return }
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g
      return { ...g, tasks: g.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t) }
    }))
  }, [userId])

  const removeGroupTask = useCallback((groupId: string, taskId: string) => {
    setGroups((prev) => prev.map((g) =>
      g.id === groupId ? { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) } : g
    ))
  }, [])

  const reorderGroupTasks = useCallback(async (groupId: string, orderedIds: string[]) => {
    if (IS_DEMO || !userId) return
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g
      const taskMap = new Map(g.tasks.map((t) => [t.id, t]))
      return { ...g, tasks: orderedIds.map((id, i) => ({ ...taskMap.get(id)!, sort_order: i })) }
    }))
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('standalone_tasks').update({ sort_order: i }).eq('id', id).eq('user_id', userId)
    ))
  }, [userId])

  // Trash helpers — remove from state + return stub item for toast
  const trashGroup = useCallback((group: { id: string }) => {
    removeGroup(group.id)
    return { id: `trash-${group.id}` }
  }, [removeGroup])

  const trashStandaloneTask = useCallback((task: { id: string; task_group_id?: string | null }) => {
    if (task.task_group_id) {
      removeGroupTask(task.task_group_id, task.id)
    } else {
      removeStandaloneTask(task.id)
    }
    return { id: `trash-${task.id}` }
  }, [removeGroupTask, removeStandaloneTask])

  return {
    groups, standaloneTasks, loading, error, refetch: fetchData,
    addGroup, updateGroup, removeGroup, reorderGroups,
    addStandaloneTask, updateStandaloneTask, removeStandaloneTask, reorderStandaloneTasks,
    addGroupTask, updateGroupTask, removeGroupTask, reorderGroupTasks,
    trashGroup, trashStandaloneTask,
  }
}
