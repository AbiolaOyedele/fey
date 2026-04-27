import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { PALETTE } from '../data/defaultClients';

function getNextCampaignColor(campaigns) {
  const used = new Set(campaigns.map((c) => c.color));
  const unused = PALETTE.find((c) => !used.has(c));
  return unused || PALETTE[campaigns.length % PALETTE.length];
}

function transformCampaigns(campaigns, tasks) {
  return campaigns.map((c) => ({
    id: c.id,
    client_id: c.client_id,
    name: c.name,
    color: c.color || PALETTE[0],
    logo: c.logo || '',
    sort_order: c.sort_order ?? 0,
    createdAt: c.created_at,
    tasks: tasks
      .filter((t) => t.campaign_id === c.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        paid: t.paid,
        amount: t.amount || 0,
        currency: t.currency || 'NGN',
        deadline: t.deadline || null,
        sort_order: t.sort_order ?? 0,
        createdAt: t.created_at,
      })),
  }));
}

export function useCampaigns(clientId, userId) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const campaignsRef = useRef([]);

  useEffect(() => { campaignsRef.current = campaigns; }, [campaigns]);

  const fetchData = useCallback(async () => {
    if (!clientId || !userId) return;
    setLoading(true);
    const [camRes, taskRes] = await Promise.all([
      supabase
        .from('client_campaigns')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('created_at'),
      supabase
        .from('campaign_tasks')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('created_at'),
    ]);
    setCampaigns(transformCampaigns(camRes.data || [], taskRes.data || []));
    setLoading(false);
  }, [clientId, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Campaigns ──────────────────────────────────────────────────────────────

  const addCampaign = useCallback(async (name, color, logo = '') => {
    if (!clientId || !userId) return;
    // Default to next unused pastel if no color provided
    const finalColor = color || getNextCampaignColor(campaignsRef.current);
    const maxSort = campaignsRef.current.length > 0
      ? Math.max(...campaignsRef.current.map((c) => c.sort_order ?? 0)) + 1 : 0;
    const { data, error } = await supabase
      .from('client_campaigns')
      .insert({ name, color: finalColor, logo, sort_order: maxSort, client_id: clientId, user_id: userId })
      .select().single();
    if (error) return;
    const newCampaign = { ...data, logo: data.logo || '', tasks: [] };
    setCampaigns((prev) => [...prev, newCampaign]);
    return newCampaign;
  }, [clientId, userId]);

  const updateCampaign = useCallback(async (campaignId, updates) => {
    const { error } = await supabase
      .from('client_campaigns')
      .update(updates)
      .eq('id', campaignId);
    if (error) return;
    setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, ...updates } : c));
  }, []);

  const deleteCampaign = useCallback(async (campaignId) => {
    await supabase.from('client_campaigns').delete().eq('id', campaignId);
    setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
  }, []);

  // ── Campaign tasks ─────────────────────────────────────────────────────────

  const addTask = useCallback(async (campaignId, title, currency = 'NGN') => {
    if (!clientId || !userId) return;
    const campaign = campaignsRef.current.find((c) => c.id === campaignId);
    const maxSort = campaign && campaign.tasks.length > 0
      ? Math.max(...campaign.tasks.map((t) => t.sort_order ?? 0)) + 1 : 0;
    const { data, error } = await supabase
      .from('campaign_tasks')
      .insert({
        campaign_id: campaignId,
        client_id: clientId,
        user_id: userId,
        title,
        currency,
        sort_order: maxSort,
        done: false,
        paid: false,
        amount: 0,
      })
      .select().single();
    if (error) return;
    const newTask = {
      id: data.id, title: data.title, done: data.done, paid: data.paid,
      amount: data.amount, currency: data.currency, deadline: data.deadline || null,
      sort_order: data.sort_order ?? 0, createdAt: data.created_at,
    };
    setCampaigns((prev) => prev.map((c) =>
      c.id === campaignId ? { ...c, tasks: [...c.tasks, newTask] } : c
    ));
  }, [clientId, userId]);

  const updateTask = useCallback(async (campaignId, taskId, updates) => {
    const dbUpdates = {};
    if ('title'      in updates) dbUpdates.title      = updates.title;
    if ('done'       in updates) dbUpdates.done       = updates.done;
    if ('paid'       in updates) dbUpdates.paid       = updates.paid;
    if ('amount'     in updates) dbUpdates.amount     = updates.amount;
    if ('currency'   in updates) dbUpdates.currency   = updates.currency;
    if ('deadline'   in updates) dbUpdates.deadline   = updates.deadline;
    if ('sort_order' in updates) dbUpdates.sort_order = updates.sort_order;
    await supabase.from('campaign_tasks').update(dbUpdates).eq('id', taskId);
    setCampaigns((prev) => prev.map((c) => {
      if (c.id !== campaignId) return c;
      return { ...c, tasks: c.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t) };
    }));
  }, []);

  const deleteTask = useCallback(async (campaignId, taskId) => {
    await supabase.from('campaign_tasks').delete().eq('id', taskId);
    setCampaigns((prev) => prev.map((c) =>
      c.id === campaignId ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) } : c
    ));
  }, []);

  const reorderTasks = useCallback(async (campaignId, orderedIds) => {
    setCampaigns((prev) => prev.map((c) => {
      if (c.id !== campaignId) return c;
      const map = new Map(c.tasks.map((t) => [t.id, t]));
      return { ...c, tasks: orderedIds.map((id, i) => ({ ...map.get(id), sort_order: i })) };
    }));
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('campaign_tasks').update({ sort_order: i }).eq('id', id)
    ));
  }, []);

  const addTasksBulk = useCallback(async (campaignId, titles, currency = 'NGN') => {
    if (!clientId || !userId || !titles.length) return;
    const campaign = campaignsRef.current.find((c) => c.id === campaignId);
    const baseSort = campaign && campaign.tasks.length > 0
      ? Math.max(...campaign.tasks.map((t) => t.sort_order ?? 0)) + 1 : 0;
    const rows = titles.map((title, i) => ({
      campaign_id: campaignId, client_id: clientId, user_id: userId,
      title, currency, sort_order: baseSort + i, done: false, paid: false, amount: 0,
    }));
    const { data } = await supabase.from('campaign_tasks').insert(rows).select();
    if (!data) return;
    const newTasks = data.map((d) => ({
      id: d.id, title: d.title, done: d.done, paid: d.paid,
      amount: d.amount, currency: d.currency, deadline: d.deadline || null,
      sort_order: d.sort_order ?? 0, createdAt: d.created_at,
    }));
    setCampaigns((prev) => prev.map((c) =>
      c.id === campaignId ? { ...c, tasks: [...c.tasks, ...newTasks] } : c
    ));
  }, [clientId, userId]);

  return {
    campaigns,
    loading,
    refetch: fetchData,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
    addTasksBulk,
  };
}
