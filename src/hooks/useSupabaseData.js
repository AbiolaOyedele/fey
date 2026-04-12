import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Transform Supabase rows into the app's data shape
function transformClients(clients, tasks, retainerPayments) {
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    logo: c.logo || '',
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
        createdAt: t.created_at,
      })),
  }));
}

export function useSupabaseData() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [clientsRes, tasksRes, retainerRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at'),
        supabase.from('tasks').select('*').order('created_at'),
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
    // Delete tasks and retainer_payments first, then client
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
    const { data, error: err } = await supabase
      .from('tasks')
      .insert({ client_id: clientId, title, done: false, paid: false, amount: 0, currency })
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
      createdAt: data.created_at,
    };

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, tasks: [...c.tasks, newTask] } : c))
    );
  }, []);

  // Update a task
  const updateTask = useCallback(async (clientId, taskId, updates) => {
    // Map app field names to DB column names
    const dbUpdates = {};
    if ('title' in updates) dbUpdates.title = updates.title;
    if ('done' in updates) dbUpdates.done = updates.done;
    if ('paid' in updates) dbUpdates.paid = updates.paid;
    if ('amount' in updates) dbUpdates.amount = updates.amount;
    if ('currency' in updates) dbUpdates.currency = updates.currency;

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
    deleteTask,
    refetch: fetchData,
  };
}
