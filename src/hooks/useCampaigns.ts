'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PALETTE } from '@/data/defaultClients'
import { getNextSortOrder } from '@/utils/sortOrder'
import type { Campaign, Task } from '@/types'

function getNextCampaignColor(campaigns: Campaign[]): string {
  const used = new Set(campaigns.map((c) => c.color))
  const unused = PALETTE.find((c) => !used.has(c))
  return unused ?? PALETTE[campaigns.length % PALETTE.length]
}

function transformCampaigns(
  campaigns: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
): Campaign[] {
  return campaigns.map((c) => ({
    id: c.id as string,
    client_id: c.client_id as string,
    name: c.name as string,
    color: (c.color as string) || PALETTE[0],
    budget: (c.budget as number) || 0,
    budget_currency: (c.budget_currency as string) || 'NGN',
    start_date: (c.start_date as string | null) || null,
    end_date: (c.end_date as string | null) || null,
    status: (c.status as string) || 'active',
    notes: (c.notes as string) || '',
    sort_order: (c.sort_order as number) ?? 0,
    created_at: c.created_at as string,
    tasks: tasks
      .filter((t) => t.campaign_id === c.id)
      .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
      .map((t) => ({
        id: t.id as string,
        title: t.title as string,
        done: t.done as boolean,
        paid: t.paid as boolean,
        amount: (t.amount as number) || 0,
        currency: (t.currency as string) || 'NGN',
        deadline: (t.deadline as string | null) || null,
        sort_order: (t.sort_order as number) ?? 0,
        createdAt: t.created_at as string,
      }) satisfies Task,
    ),
  }))
}

export function useCampaigns(clientId: string | undefined, userId: string | undefined) {
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([])
  const [loading,      setLoading]      = useState(true)
  const campaignsRef = useRef<Campaign[]>([])

  useEffect(() => { campaignsRef.current = campaigns }, [campaigns])

  const fetchData = useCallback(async () => {
    if (!clientId || !userId) return
    setLoading(true)
    const [camRes, taskRes] = await Promise.all([
      supabase.from('client_campaigns').select('*').eq('client_id', clientId).eq('user_id', userId).eq('app', 'fey').order('sort_order', { ascending: true }).order('created_at'),
      supabase.from('campaign_tasks').select('*').eq('client_id', clientId).eq('user_id', userId).eq('app', 'fey').order('sort_order', { ascending: true }).order('created_at'),
    ])
    setCampaigns(transformCampaigns(
      (camRes.data || []) as Record<string, unknown>[],
      (taskRes.data || []) as Record<string, unknown>[],
    ))
    setLoading(false)
  }, [clientId, userId])

  useEffect(() => { void fetchData() }, [fetchData])

  const addCampaign = useCallback(async (name: string, color?: string, logo = ''): Promise<Campaign | undefined> => {
    if (!clientId || !userId) return
    const finalColor = color || getNextCampaignColor(campaignsRef.current)
    const maxSort = getNextSortOrder(campaignsRef.current)
    const { data, error } = await supabase
      .from('client_campaigns')
      .insert({ name, color: finalColor, logo, sort_order: maxSort, client_id: clientId, user_id: userId, app: 'fey' })
      .select().single()
    if (error) return
    const newCampaign: Campaign = {
      ...(data as Record<string, unknown>),
      id: (data as Record<string, unknown>).id as string,
      client_id: clientId,
      name,
      color: finalColor,
      budget: 0,
      budget_currency: 'NGN',
      start_date: null,
      end_date: null,
      status: 'active',
      notes: '',
      sort_order: maxSort,
      created_at: (data as Record<string, unknown>).created_at as string,
      tasks: [],
    }
    setCampaigns((prev) => [...prev, newCampaign])
    return newCampaign
  }, [clientId, userId])

  const updateCampaign = useCallback(async (campaignId: string, updates: Partial<Campaign>) => {
    const { error } = await supabase.from('client_campaigns').update(updates).eq('id', campaignId)
    if (error) return
    setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, ...updates } : c))
  }, [])

  const deleteCampaign = useCallback(async (campaignId: string) => {
    await supabase.from('client_campaigns').delete().eq('id', campaignId)
    setCampaigns((prev) => prev.filter((c) => c.id !== campaignId))
  }, [])

  const addTask = useCallback(async (campaignId: string, title: string, currency = 'NGN') => {
    if (!clientId || !userId) return
    const campaign = campaignsRef.current.find((c) => c.id === campaignId)
    const maxSort = getNextSortOrder(campaign?.tasks ?? [])
    const { data, error } = await supabase
      .from('campaign_tasks')
      .insert({ campaign_id: campaignId, client_id: clientId, user_id: userId, title, currency, sort_order: maxSort, done: false, paid: false, amount: 0, app: 'fey' })
      .select().single()
    if (error) return
    const row = data as Record<string, unknown>
    const newTask: Task = {
      id: row.id as string, title: row.title as string, done: row.done as boolean,
      paid: row.paid as boolean, amount: row.amount as number,
      currency: row.currency as string, deadline: (row.deadline as string | null) || null,
      sort_order: (row.sort_order as number) ?? 0, createdAt: row.created_at as string,
    }
    setCampaigns((prev) => prev.map((c) =>
      c.id === campaignId ? { ...c, tasks: [...(c.tasks ?? []), newTask] } : c
    ))
  }, [clientId, userId])

  const updateTask = useCallback(async (campaignId: string, taskId: string, updates: Partial<Task>) => {
    const dbUpdates: Partial<Task> = {}
    if ('title'      in updates) dbUpdates.title      = updates.title
    if ('done'       in updates) dbUpdates.done       = updates.done
    if ('paid'       in updates) dbUpdates.paid       = updates.paid
    if ('amount'     in updates) dbUpdates.amount     = updates.amount
    if ('currency'   in updates) dbUpdates.currency   = updates.currency
    if ('deadline'   in updates) dbUpdates.deadline   = updates.deadline
    if ('sort_order' in updates) dbUpdates.sort_order = updates.sort_order
    await supabase.from('campaign_tasks').update(dbUpdates).eq('id', taskId)
    setCampaigns((prev) => prev.map((c) => {
      if (c.id !== campaignId) return c
      return { ...c, tasks: (c.tasks ?? []).map((t) => t.id === taskId ? { ...t, ...updates } : t) }
    }))
  }, [])

  const deleteTask = useCallback(async (campaignId: string, taskId: string) => {
    await supabase.from('campaign_tasks').delete().eq('id', taskId)
    setCampaigns((prev) => prev.map((c) =>
      c.id === campaignId ? { ...c, tasks: (c.tasks ?? []).filter((t) => t.id !== taskId) } : c
    ))
  }, [])

  const reorderTasks = useCallback(async (campaignId: string, orderedIds: string[]) => {
    setCampaigns((prev) => prev.map((c) => {
      if (c.id !== campaignId) return c
      const map = new Map((c.tasks ?? []).map((t) => [t.id, t]))
      return { ...c, tasks: orderedIds.map((id, i) => ({ ...map.get(id)!, sort_order: i })) }
    }))
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('campaign_tasks').update({ sort_order: i }).eq('id', id)
    ))
  }, [])

  const reorderCampaigns = useCallback(async (orderedIds: string[]) => {
    setCampaigns((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]))
      return orderedIds.map((id, i) => ({ ...map.get(id)!, sort_order: i }))
    })
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('client_campaigns').update({ sort_order: i }).eq('id', id)
    ))
  }, [])

  const addTasksBulk = useCallback(async (campaignId: string, titles: string[], currency = 'NGN') => {
    if (!clientId || !userId || !titles.length) return
    const campaign = campaignsRef.current.find((c) => c.id === campaignId)
    const baseSort = getNextSortOrder(campaign?.tasks ?? [])
    const rows = titles.map((title, i) => ({
      campaign_id: campaignId, client_id: clientId, user_id: userId,
      title, currency, sort_order: baseSort + i, done: false, paid: false, amount: 0, app: 'fey',
    }))
    const { data } = await supabase.from('campaign_tasks').insert(rows).select()
    if (!data) return
    const newTasks = (data as Record<string, unknown>[]).map((d) => ({
      id: d.id as string, title: d.title as string, done: d.done as boolean, paid: d.paid as boolean,
      amount: d.amount as number, currency: d.currency as string,
      deadline: (d.deadline as string | null) || null,
      sort_order: (d.sort_order as number) ?? 0, createdAt: d.created_at as string,
    }) satisfies Task)
    setCampaigns((prev) => prev.map((c) =>
      c.id === campaignId ? { ...c, tasks: [...(c.tasks ?? []), ...newTasks] } : c
    ))
  }, [clientId, userId])

  return {
    campaigns, loading, refetch: fetchData,
    addCampaign, updateCampaign, deleteCampaign, reorderCampaigns,
    addTask, updateTask, deleteTask, reorderTasks, addTasksBulk,
  }
}
