import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Transform Supabase rows into the app's data shape
function transformClients(clients, tasks, retainerPayments) {
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    logo: c.logo || '',
    task_mode: c.task_mode || false,
    retainer: Number(c.retainer) || 0,
    retainerPaid: retainerPayments
      .filter((rp) => rp.client_id === c.id)
      .reduce((acc, rp) => {
        acc[rp.month] = rp.paid;
        return acc;
      }, {}),
    tasks: tasks
      .filter((t) => t.client_id === c.id)
      .map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        paid: t.paid,
        amount: Number(t.amount) || 0,
        currency: t.currency || 'NGN',
        deadline: t.deadline || null,
        sort_order: t.sort_order ?? 0,
        createdAt: t.created_at,
      })),
  }));
}

export function useSupabaseData() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const clientsRef = useRef([]);

  // Keep ref in sync with state
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [clientsRes, tasksRes, retainerRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at'),
        supabase.from('tasks').select('*').order('sort_order', { ascending: true }).order('created_at'),
        supabase.from('retainer_payments').select('*'),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (retainerRes.error) throw retainerRes.error;

      setClients(transformClients(clientsRes.data || [], tasksRes.data || [], retainerRes.data || []));

      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add a new client
  const addClient = useCallback(async (name, color, logo = '') => {
    const { data, error: err } = await supabase
      .from('clients')
      .insert({ name, color, logo, retainer: 0 })
      .select()
      .single();

    if (err) { setError(err.message); return; }

    setClients((prev) => [
      ...prev,
      { id: data.id, name: data.name, color: data.color, logo: data.logo || '', retainer: 0, retainerPaid: {}, tasks: [] },
    ]);
  }, []);

  // Update a client's name, color, and/or logo
  const updateClient = useCallback(async (clientId, updates) => {
    const dbUpdates = {};
    if ('name' in updates) dbUpdates.name = updates.name;
    if ('color' in updates) dbUpdates.color = updates.color;
    if ('logo' in updates) dbUpdates.logo = updates.logo;
    if ('task_mode' in updates) dbUpdates.task_mode = updates.task_mode;

    const { error: err } = await supabase
      .from('clients')
      .update(dbUpdates)
      .eq('id', clientId);

    if (err) { setError(err.message); return; }

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c))
    );
  }, []);

  // Delete a client (cascades to tasks and retainer_payments via DB)
  const deleteClient = useCallback(async (clientId) => {
    await supabase.from('tasks').delete().eq('client_id', clientId);
    await supabase.from('retainer_payments').delete().eq('client_id', clientId);
    const { error: err } = await supabase.from('clients').delete().eq('id', clientId);

    if (err) { setError(err.message); return; }

    setClients((prev) => prev.filter((c) => c.id !== clientId));
  }, []);

  // Update client retainer amount
  const updateRetainer = useCallback(async (clientId, retainer) => {
    const { error: err } = await supabase
      .from('clients')
      .update({ retainer })
      .eq('id', clientId);

    if (err) { setError(err.message); return; }

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, retainer } : c))
    );
  }, []);

  // Toggle retainer paid for a given month
  const toggleRetainerPaid = useCallback(async (clientId, month, paid) => {
    const { error: err } = await supabase
      .from('retainer_payments')
      .upsert(
        { client_id: clientId, month, paid },
        { onConflict: 'client_id,month' }
      );

    if (err) { setError(err.message); return; }

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        return { ...c, retainerPaid: { ...c.retainerPaid, [month]: paid } };
      })
    );
  }, []);

  // Add a task
  const addTask = useCallback(async (clientId, title, currency = 'NGN') => {
    // Compute sort_order as max existing + 1 so new tasks go to the end
    const existingClient = clientsRef.current.find((c) => c.id === clientId);
    const maxSort = existingClient && existingClient.tasks.length > 0
      ? Math.max(...existingClient.tasks.map((t) => t.sort_order ?? 0)) + 1
      : 0;

    const { data, error: err } = await supabase
      .from('tasks')
      .insert({ client_id: clientId, title, done: false, paid: false, amount: 0, currency, sort_order: maxSort })
      .select()
      .single();

    if (err) { setError(err.message); return; }

    const newTask = {
      id: data.id,
      title: data.title,
      done: data.done,
      paid: data.paid,
      amount: Number(data.amount) || 0,
      currency: data.currency || currency,
      deadline: data.deadline || null,
      sort_order: data.sort_order ?? maxSort,
      createdAt: data.created_at,
    };

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, tasks: [...c.tasks, newTask] } : c))
    );
  }, []);

  // Update a task
  const updateTask = useCallback(async (clientId, taskId, updates) => {
    const dbUpdates = {};
    if ('title' in updates) dbUpdates.title = updates.title;
    if ('done' in updates) dbUpdates.done = updates.done;
    if ('paid' in updates) dbUpdates.paid = updates.paid;
    if ('amount' in updates) dbUpdates.amount = updates.amount;
    if ('currency' in updates) dbUpdates.currency = updates.currency;
    if ('deadline' in updates) dbUpdates.deadline = updates.deadline;
    if ('sort_order' in updates) dbUpdates.sort_order = updates.sort_order;

    const { error: err } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', taskId);

    if (err) { setError(err.message); return; }

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
        };
      })
    );
  }, []);

  // Reorder tasks within a client — saves sort_order to DB
  const reorderTasks = useCallback(async (clientId, orderedIds) => {
    // Optimistic update
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const taskMap = new Map(c.tasks.map((t) => [t.id, t]));
        return {
          ...c,
          tasks: orderedIds.map((id, i) => ({ ...taskMap.get(id), sort_order: i })),
        };
      })
    );
    // Persist
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('tasks').update({ sort_order: i }).eq('id', id)
      )
    );
  }, []);

  // Delete a task
  const deleteTask = useCallback(async (clientId, taskId) => {
    const { error: err } = await supabase.from('tasks').delete().eq('id', taskId);

    if (err) { setError(err.message); return; }

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
      })
    );
  }, []);

  return {
    clients,
    loading,
    error,
    addClient,
    updateClient,
    deleteClient,
    updateRetainer,
    toggleRetainerPaid,
    addTask,
    updateTask,
    reorderTasks,
    deleteTask,
    refetch: fetchData,
  };
}
