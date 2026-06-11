'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { IS_DEMO } from '@/lib/constants'
import { useDemoDataCtx } from '@/contexts/DemoContext'
import { getNextSortOrder } from '@/utils/sortOrder'
import type { Client, Task } from '@/types'

type RawRow = Record<string, unknown>

function transformClients(
  clients: RawRow[],
  tasks: RawRow[],
  retainerPayments: RawRow[],
  campaignTasks: RawRow[] = [],
): Client[] {
  return clients.map((c) => {
    const directTasks: Task[] = tasks
      .filter((t) => t.client_id === c.id)
      .map((t) => ({
        id: t.id as string,
        title: t.title as string,
        done: t.done as boolean,
        paid: t.paid as boolean,
        amount: Number(t.amount) || 0,
        currency: (t.currency as string) || 'NGN',
        deadline: (t.deadline as string | null) || null,
        sort_order: (t.sort_order as number) ?? 0,
        createdAt: t.created_at as string,
        _isCampaignTask: false,
      }))

    const campaignTasksForClient: Task[] = campaignTasks
      .filter((t) => t.client_id === c.id)
      .map((t) => ({
        id: t.id as string,
        title: t.title as string,
        done: t.done as boolean,
        paid: false,
        amount: 0,
        currency: 'NGN',
        deadline: (t.deadline as string | null) || null,
        sort_order: (t.sort_order as number) ?? 0,
        createdAt: t.created_at as string,
        _isCampaignTask: true,
      }))

    return {
      id: c.id as string,
      name: c.name as string,
      color: c.color as string,
      logo: (c.logo as string) || '',
      email: (c.email as string) || '',
      phone: (c.phone as string) || '',
      address: (c.address as string) || '',
      website: (c.website as string) || '',
      tax_id: (c.tax_id as string) || '',
      task_mode: (c.task_mode as boolean) || false,
      retainer: Number(c.retainer) || 0,
      retainer_currency: (c.retainer_currency as string) || 'NGN',
      retainerPaid: retainerPayments
        .filter((rp) => rp.client_id === c.id)
        .reduce<Record<string, boolean>>((acc, rp) => {
          acc[rp.month as string] = rp.paid as boolean
          return acc
        }, {}),
      tasks: directTasks,
      allTasks: [...directTasks, ...campaignTasksForClient],
    }
  })
}

export interface LinkedClient {
  id: string
  user_id: string
  token: string
  client_id: string
  created_at: string
  [key: string]: unknown
}

export function useSupabaseData(userId: string | undefined) {
  const demoCtx = useDemoDataCtx()

  const [clients,       setClients]       = useState<Client[]>([])
  const [linkedClients, setLinkedClients] = useState<LinkedClient[]>([])
  const [loading,       setLoading]       = useState(!IS_DEMO)
  const [error,         setError]         = useState<string | null>(null)
  const clientsRef = useRef<Client[]>([])

  useEffect(() => { clientsRef.current = clients }, [clients])

  const fetchData = useCallback(async () => {
    if (IS_DEMO) return
    if (!userId) return
    try {
      const [clientsRes, tasksRes, retainerRes, campaignTasksRes, linkedRes] = await Promise.all([
        supabase.from('clients').select('*').eq('user_id', userId).eq('app', 'fey').order('created_at'),
        supabase.from('tasks').select('*').eq('user_id', userId).eq('app', 'fey').order('sort_order', { ascending: true }).order('created_at'),
        supabase.from('retainer_payments').select('*').eq('user_id', userId).eq('app', 'fey'),
        supabase.from('campaign_tasks').select('*').eq('user_id', userId).eq('app', 'fey'),
        supabase.from('user_linked_clients').select('*').eq('user_id', userId).eq('app', 'fey').order('created_at'),
      ])

      if (clientsRes.error) throw clientsRes.error
      if (tasksRes.error)   throw tasksRes.error
      if (retainerRes.error) throw retainerRes.error

      setClients(transformClients(
        (clientsRes.data || []) as RawRow[],
        (tasksRes.data || []) as RawRow[],
        (retainerRes.data || []) as RawRow[],
        (campaignTasksRes.data || []) as RawRow[],
      ))
      setLinkedClients((linkedRes.data || []) as LinkedClient[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void fetchData() }, [fetchData])

  const addClient = useCallback(async (name: string, color: string, logo = '') => {
    if (IS_DEMO || !userId) return
    const { data, error: err } = await supabase
      .from('clients')
      .insert({ name, color, logo, retainer: 0, user_id: userId, app: 'fey' })
      .select().single()
    if (err) { setError(err.message); return }
    const row = data as RawRow
    setClients((prev) => [
      ...prev,
      {
        id: row.id as string, name: row.name as string, color: row.color as string,
        logo: (row.logo as string) || '', email: '', phone: '', address: '', website: '', tax_id: '',
        task_mode: false, retainer: 0, retainer_currency: 'NGN', retainerPaid: {}, tasks: [],
      },
    ])
  }, [userId])

  const updateClient = useCallback(async (clientId: string, updates: Partial<Client>) => {
    if (IS_DEMO || !userId) return
    const coreUpdates: Partial<RawRow> = {}
    if ('name'      in updates) coreUpdates.name      = updates.name
    if ('color'     in updates) coreUpdates.color     = updates.color
    if ('logo'      in updates) coreUpdates.logo      = updates.logo
    if ('task_mode' in updates) coreUpdates.task_mode = updates.task_mode

    const contactUpdates: Partial<RawRow> = {}
    if ('email'   in updates) contactUpdates.email   = updates.email
    if ('phone'   in updates) contactUpdates.phone   = updates.phone
    if ('address' in updates) contactUpdates.address = updates.address
    if ('website' in updates) contactUpdates.website = updates.website
    if ('tax_id'  in updates) contactUpdates.tax_id  = updates.tax_id

    const dbUpdates = { ...coreUpdates, ...contactUpdates }

    const { error: err } = await supabase.from('clients').update(dbUpdates).eq('id', clientId).eq('user_id', userId)

    if (err) {
      if (Object.keys(contactUpdates).length > 0 && Object.keys(coreUpdates).length > 0) {
        const { error: err2 } = await supabase.from('clients').update(coreUpdates).eq('id', clientId).eq('user_id', userId)
        if (err2) { setError(err2.message); return }
      } else {
        setError(err.message); return
      }
    }

    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c)))
  }, [userId])

  const deleteClient = useCallback(async (clientId: string) => {
    if (IS_DEMO || !userId) return
    await supabase.from('tasks').delete().eq('client_id', clientId).eq('user_id', userId)
    await supabase.from('retainer_payments').delete().eq('client_id', clientId).eq('user_id', userId)
    const { error: err } = await supabase.from('clients').delete().eq('id', clientId).eq('user_id', userId)
    if (err) { setError(err.message); return }
    setClients((prev) => prev.filter((c) => c.id !== clientId))
  }, [userId])

  const updateRetainer = useCallback(async (clientId: string, retainer: number, retainer_currency?: string) => {
    if (IS_DEMO || !userId) return
    const updates: Partial<RawRow> = { retainer }
    if (retainer_currency) updates.retainer_currency = retainer_currency
    const { error: err } = await supabase.from('clients').update(updates).eq('id', clientId).eq('user_id', userId)
    if (err) { setError(err.message); return }
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, retainer, ...(retainer_currency ? { retainer_currency } : {}) } : c))
    )
  }, [userId])

  const toggleRetainerPaid = useCallback(async (clientId: string, month: string, paid: boolean) => {
    if (IS_DEMO || !userId) return
    const { data: existing } = await supabase
      .from('retainer_payments')
      .select('id')
      .eq('client_id', clientId)
      .eq('month', month)
      .eq('user_id', userId)
      .maybeSingle()

    let err
    if (existing) {
      ;({ error: err } = await supabase.from('retainer_payments').update({ paid }).eq('id', (existing as RawRow).id).eq('user_id', userId))
    } else {
      ;({ error: err } = await supabase.from('retainer_payments').insert({ client_id: clientId, month, paid, user_id: userId, app: 'fey' }))
    }
    if (err) { setError(err.message); return }

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c
        return { ...c, retainerPaid: { ...c.retainerPaid, [month]: paid } }
      })
    )
  }, [userId])

  const addTask = useCallback(async (clientId: string, title: string, currency = 'NGN') => {
    if (IS_DEMO || !userId) return
    const existingClient = clientsRef.current.find((c) => c.id === clientId)
    const maxSort = getNextSortOrder(existingClient?.tasks ?? [])

    const { data, error: err } = await supabase
      .from('tasks')
      .insert({ client_id: clientId, title, done: false, paid: false, amount: 0, currency, sort_order: maxSort, user_id: userId, app: 'fey' })
      .select().single()
    if (err) { setError(err.message); return }

    const row = data as RawRow
    const newTask: Task = {
      id: row.id as string, title: row.title as string,
      done: row.done as boolean, paid: row.paid as boolean,
      amount: Number(row.amount) || 0, currency: (row.currency as string) || currency,
      deadline: (row.deadline as string | null) || null,
      sort_order: (row.sort_order as number) ?? maxSort,
      createdAt: row.created_at as string,
    }

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, tasks: [...c.tasks, newTask] } : c))
    )
  }, [userId])

  const updateTask = useCallback(async (clientId: string, taskId: string, updates: Partial<Task>) => {
    if (IS_DEMO || !userId) return
    const dbUpdates: Partial<RawRow> = {}
    if ('title'      in updates) dbUpdates.title      = updates.title
    if ('done'       in updates) dbUpdates.done       = updates.done
    if ('paid'       in updates) dbUpdates.paid       = updates.paid
    if ('amount'     in updates) dbUpdates.amount     = updates.amount
    if ('currency'   in updates) dbUpdates.currency   = updates.currency
    if ('deadline'   in updates) dbUpdates.deadline   = updates.deadline
    if ('sort_order' in updates) dbUpdates.sort_order = updates.sort_order

    const { error: err } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId).eq('user_id', userId)
    if (err) { setError(err.message); return }

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c
        return { ...c, tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)) }
      })
    )
  }, [userId])

  const reorderTasks = useCallback(async (clientId: string, orderedIds: string[]) => {
    if (IS_DEMO || !userId) return
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c
        const taskMap = new Map(c.tasks.map((t) => [t.id, t]))
        return { ...c, tasks: orderedIds.map((id, i) => ({ ...taskMap.get(id)!, sort_order: i })) }
      })
    )
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('tasks').update({ sort_order: i }).eq('id', id).eq('user_id', userId)
      )
    )
  }, [userId])

  const deleteTask = useCallback(async (clientId: string, taskId: string) => {
    if (IS_DEMO || !userId) return
    const { error: err } = await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', userId)
    if (err) { setError(err.message); return }
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c
        return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
      })
    )
  }, [userId])

  // In demo mode, serve data from DemoDataContext so pages don't need
  // to know about the demo/real split — they always call useSupabaseData.
  if (IS_DEMO && demoCtx) {
    return {
      clients:       demoCtx.clients,
      linkedClients: [] as LinkedClient[],
      loading:       false as const,
      error:         null,
      addClient:     demoCtx.addClient,
      updateClient:  demoCtx.updateClient,
      deleteClient:  demoCtx.deleteClient,
      updateRetainer:    demoCtx.updateRetainer,
      toggleRetainerPaid: demoCtx.toggleRetainerPaid,
      addTask:       demoCtx.addTask,
      updateTask:    demoCtx.updateTask,
      reorderTasks:  demoCtx.reorderTasks,
      deleteTask:    demoCtx.deleteTask,
      refetch:       demoCtx.refetch,
    }
  }

  return {
    clients, linkedClients, loading, error,
    addClient, updateClient, deleteClient,
    updateRetainer, toggleRetainerPaid,
    addTask, updateTask, reorderTasks, deleteTask,
    refetch: fetchData,
  }
}
