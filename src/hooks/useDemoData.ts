'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { DEMO_CLIENTS, DEMO_GROUPS, DEMO_STANDALONE_TASKS } from '@/data/demoData'
import type { Client, Task, TaskGroup, StandaloneTask, TrashItem } from '@/types'

let _idCounter = 9000
const newId = (prefix: string): string => `${prefix}-new-${++_idCounter}`

const cloneClients    = (): Client[]        => JSON.parse(JSON.stringify(DEMO_CLIENTS))
const cloneGroups     = (): TaskGroup[]     => JSON.parse(JSON.stringify(DEMO_GROUPS))
const cloneStandalone = (): StandaloneTask[] => JSON.parse(JSON.stringify(DEMO_STANDALONE_TASKS))

export interface DemoTaskGroupData {
  groups: TaskGroup[]
  standaloneTasks: StandaloneTask[]
  loading: false
  error: null
  refetch: () => void
  addGroup: (name: string, color: string, icon?: string) => void
  updateGroup: (groupId: string, updates: Partial<TaskGroup>) => void
  removeGroup: (groupId: string) => void
  reorderGroups: (orderedIds: string[]) => void
  addStandaloneTask: (title: string) => void
  updateStandaloneTask: (taskId: string, updates: Partial<StandaloneTask>) => void
  removeStandaloneTask: (taskId: string) => void
  reorderStandaloneTasks: (orderedIds: string[]) => void
  addGroupTask: (groupId: string, title: string) => void
  updateGroupTask: (groupId: string, taskId: string, updates: Partial<StandaloneTask>) => void
  reorderGroupTasks: (groupId: string, orderedIds: string[]) => void
  trashGroup: (group: { id: string; [key: string]: unknown }) => Pick<TrashItem, 'id'>
  trashStandaloneTask: (task: { id: string; task_group_id?: string; [key: string]: unknown }) => Pick<TrashItem, 'id'>
}

export interface UseDemoDataReturn {
  clients: Client[]
  loading: false
  error: null
  addClient: (name: string, color: string, logo?: string) => void
  updateClient: (clientId: string, updates: Partial<Client>) => void
  deleteClient: (clientId: string) => void
  updateRetainer: (clientId: string, retainer: number, currency?: string) => void
  toggleRetainerPaid: (clientId: string, month: string, paid: boolean) => void
  addTask: (clientId: string, title: string, currency?: string) => void
  updateTask: (clientId: string, taskId: string, updates: Partial<Task>) => void
  reorderTasks: (clientId: string, orderedIds: string[]) => void
  deleteTask: (clientId: string, taskId: string) => void
  refetch: () => void
  trashClient: (client: Client) => Pick<TrashItem, 'id'>
  trashTask: (task: { id: string; [key: string]: unknown }, clientId: string) => void
  taskGroupData: DemoTaskGroupData
}

export function useDemoData(): UseDemoDataReturn {
  const [clients,         setClients]         = useState<Client[]>(cloneClients)
  const [groups,          setGroups]           = useState<TaskGroup[]>(cloneGroups)
  const [standaloneTasks, setStandaloneTasks]  = useState<StandaloneTask[]>(cloneStandalone)

  const clientsRef    = useRef(clients)
  const groupsRef     = useRef(groups)
  const standaloneRef = useRef(standaloneTasks)
  useEffect(() => { clientsRef.current    = clients         }, [clients])
  useEffect(() => { groupsRef.current     = groups          }, [groups])
  useEffect(() => { standaloneRef.current = standaloneTasks }, [standaloneTasks])

  // ── Client mutations ──────────────────────────────────────────────────────

  const addClient = useCallback((name: string, color: string, logo = '') => {
    const id = newId('c')
    setClients((prev) => [
      ...prev,
      { id, name, color, logo, email: '', phone: '', address: '', website: '', tax_id: '', task_mode: false, retainer: 0, retainer_currency: 'NGN', retainerPaid: {}, tasks: [] },
    ])
  }, [])

  const updateClient = useCallback((clientId: string, updates: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c)))
  }, [])

  const deleteClient = useCallback((clientId: string) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId))
  }, [])

  const updateRetainer = useCallback((clientId: string, retainer: number) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, retainer } : c)))
  }, [])

  const toggleRetainerPaid = useCallback((clientId: string, month: string, paid: boolean) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== clientId ? c : { ...c, retainerPaid: { ...c.retainerPaid, [month]: paid } }
      )
    )
  }, [])

  // ── Client-task mutations ─────────────────────────────────────────────────

  const addTask = useCallback((clientId: string, title: string, currency = 'NGN') => {
    const id      = newId('t')
    const existing = clientsRef.current.find((c) => c.id === clientId)
    const maxSort  = existing?.tasks?.length
      ? Math.max(...existing.tasks.map((t) => t.sort_order ?? 0)) + 1
      : 0
    const newTask: Task = {
      id, title, done: false, paid: false, amount: 0,
      currency, deadline: null, sort_order: maxSort, createdAt: new Date().toISOString(),
    }
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, tasks: [...c.tasks, newTask] } : c))
    )
  }, [])

  const updateTask = useCallback((clientId: string, taskId: string, updates: Partial<Task>) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== clientId ? c
          : { ...c, tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)) }
      )
    )
  }, [])

  const reorderTasks = useCallback((clientId: string, orderedIds: string[]) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c
        const taskMap = new Map(c.tasks.map((t) => [t.id, t]))
        return { ...c, tasks: orderedIds.map((id, i) => ({ ...taskMap.get(id)!, sort_order: i })) }
      })
    )
  }, [])

  const deleteTask = useCallback((clientId: string, taskId: string) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== clientId ? c : { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
      )
    )
  }, [])

  // ── Trash helpers ─────────────────────────────────────────────────────────

  const trashClient = useCallback((client: Client): Pick<TrashItem, 'id'> => {
    setClients((prev) => prev.filter((c) => c.id !== client.id))
    return { id: `demo-trash-${client.id}` }
  }, [])

  const trashTask = useCallback((task: { id: string; [key: string]: unknown }, clientId: string) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== clientId ? c : { ...c, tasks: c.tasks.filter((t) => t.id !== task.id) }
      )
    )
  }, [])

  // ── Group mutations ───────────────────────────────────────────────────────

  const addGroup = useCallback((name: string, color: string, icon = '') => {
    const id      = newId('g')
    const maxSort = groupsRef.current.length
      ? Math.max(...groupsRef.current.map((g) => g.sort_order ?? 0)) + 1
      : 0
    setGroups((prev) => [
      ...prev,
      { id, name, color, icon, sort_order: maxSort, createdAt: new Date().toISOString(), tasks: [] },
    ])
  }, [])

  const updateGroup = useCallback((groupId: string, updates: Partial<TaskGroup>) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g)))
  }, [])

  const removeGroup = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId))
  }, [])

  const reorderGroups = useCallback((orderedIds: string[]) => {
    setGroups((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]))
      return orderedIds.map((id, i) => ({ ...map.get(id)!, sort_order: i }))
    })
  }, [])

  // ── Standalone-task mutations ─────────────────────────────────────────────

  const addStandaloneTask = useCallback((title: string) => {
    const id      = newId('st')
    const maxSort = standaloneRef.current.length
      ? Math.max(...standaloneRef.current.map((t) => t.sort_order ?? 0)) + 1
      : 0
    setStandaloneTasks((prev) => [
      ...prev,
      { id, title, done: false, deadline: null, sort_order: maxSort, createdAt: new Date().toISOString() },
    ])
  }, [])

  const updateStandaloneTask = useCallback((taskId: string, updates: Partial<StandaloneTask>) => {
    setStandaloneTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    )
  }, [])

  const removeStandaloneTask = useCallback((taskId: string) => {
    setStandaloneTasks((prev) => prev.filter((t) => t.id !== taskId))
  }, [])

  const reorderStandaloneTasks = useCallback((orderedIds: string[]) => {
    setStandaloneTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]))
      return orderedIds.map((id, i) => ({ ...map.get(id)!, sort_order: i }))
    })
  }, [])

  // ── Group-task mutations ──────────────────────────────────────────────────

  const addGroupTask = useCallback((groupId: string, title: string) => {
    const id      = newId('gt')
    const group   = groupsRef.current.find((g) => g.id === groupId)
    const maxSort = group?.tasks?.length
      ? Math.max(...group.tasks.map((t) => t.sort_order ?? 0)) + 1
      : 0
    const newTask: StandaloneTask = { id, title, done: false, deadline: null, sort_order: maxSort, createdAt: new Date().toISOString() }
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, tasks: [...g.tasks, newTask] } : g))
    )
  }, [])

  const updateGroupTask = useCallback((groupId: string, taskId: string, updates: Partial<StandaloneTask>) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId ? g
          : { ...g, tasks: g.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)) }
      )
    )
  }, [])

  const reorderGroupTasks = useCallback((groupId: string, orderedIds: string[]) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        const taskMap = new Map(g.tasks.map((t) => [t.id, t]))
        return { ...g, tasks: orderedIds.map((id, i) => ({ ...taskMap.get(id)!, sort_order: i })) }
      })
    )
  }, [])

  const trashGroup = useCallback((group: { id: string; [key: string]: unknown }): Pick<TrashItem, 'id'> => {
    return { id: `demo-trash-${group.id}` }
  }, [])

  const trashStandaloneTask = useCallback((task: { id: string; task_group_id?: string; [key: string]: unknown }): Pick<TrashItem, 'id'> => {
    if (task.task_group_id) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id !== task.task_group_id ? g
            : { ...g, tasks: g.tasks.filter((t) => t.id !== task.id) }
        )
      )
    }
    return { id: `demo-trash-${task.id}` }
  }, [])

  return {
    clients,
    loading: false,
    error: null,
    addClient,
    updateClient,
    deleteClient,
    updateRetainer,
    toggleRetainerPaid,
    addTask,
    updateTask,
    reorderTasks,
    deleteTask,
    refetch: () => {},
    trashClient,
    trashTask,
    taskGroupData: {
      groups,
      standaloneTasks,
      loading: false,
      error: null,
      refetch: () => {},
      addGroup,
      updateGroup,
      removeGroup,
      reorderGroups,
      addStandaloneTask,
      updateStandaloneTask,
      removeStandaloneTask,
      reorderStandaloneTasks,
      addGroupTask,
      updateGroupTask,
      reorderGroupTasks,
      trashGroup,
      trashStandaloneTask,
    },
  }
}
