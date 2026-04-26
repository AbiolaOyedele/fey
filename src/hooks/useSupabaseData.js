import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

// Transform Supabase rows into the app's data shape
function transformClients(clients, tasks, retainerPayments) {
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    logo: c.logo || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    website: c.website || '',
    tax_id: c.tax_id || '',
    task_mode: c.task_mode || false,
    retainer: Number(c.retainer) || 0,
    retainer_currency: c.retainer_currency || 'NGN',
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

export function useSupabaseData(userId) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(!IS_DEMO); // false immediately in demo mode
  const [error, setError] = useState(null);
  const clientsRef = useRef([]);

  // Keep ref in sync with state
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (IS_DEMO) return; // no Supabase reads in demo mode
    if (!userId) return;  // wait until we know who the user is
    try {
      const [clientsRes, tasksRes, retainerRes] = await Promise.all([
        supabase.from('clients').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('tasks').select('*').eq('user_id', userId).order('sort_order', { ascending: true }).order('created_at'),
        supabase.from('retainer_payments').select('*').eq('user_id', userId),
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
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add a new client
  const addClient = useCallback(async (name, color, logo = '') => {
    if (IS_DEMO || !userId) return;
    const { data, error: err } = await supabase
      .from('clients')
      .insert({ name, color, logo, retainer: 0, user_id: userId })
      .select()
      .single();

    if (err) { setError(err.message); return; }

    setClients((prev) => [
      ...prev,
      { id: data.id, name: data.name, color: data.color, logo: data.logo || '', retainer: 0, retainerPaid: {}, tasks: [] },
    ]);
  }, [userId]);

  // Update a client's name, color, logo, and/or contact details
  const updateClient = useCallback(async (clientId, updates) => {
    if (IS_DEMO || !userId) return;
    const coreUpdates = {};
    if ('name' in updates) coreUpdates.name = updates.name;
    if ('color' in updates) coreUpdates.color = updates.color;
    if ('logo' in updates) coreUpdates.logo = updates.logo;
    if ('task_mode' in updates) coreUpdates.task_mode = updates.task_mode;

    const contactUpdates = {};
    if ('email' in updates) contactUpdates.email = updates.email;
    if ('phone' in updates) contactUpdates.phone = updates.phone;
    if ('address' in updates) contactUpdates.address = updates.address;
    if ('website' in updates) contactUpdates.website = updates.website;
    if ('tax_id' in updates) contactUpdates.tax_id = updates.tax_id;

    const dbUpdates = { ...coreUpdates, ...contactUpdates };

    const { error: err } = await supabase
      .from('clients')
      .update(dbUpdates)
      .eq('id', clientId)
      .eq('user_id', userId);

    if (err) {
      // If contact columns don't exist yet (migration pending), fall back to core fields only
      if (Object.keys(contactUpdates).length > 0 && Object.keys(coreUpdates).length > 0) {
        const { error: err2 } = await supabase
          .from('clients')
          .update(coreUpdates)
          .eq('id', clientId)
          .eq('user_id', userId);
        if (err2) { setError(err2.message); return; }
      } else {
        setError(err.message);
        return;
      }
    }

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c))
    );
  }, [userId]);

  // Delete a client (cascades to tasks and retainer_payments via DB)
  const deleteClient = useCallback(async (clientId) => {
    if (IS_DEMO || !userId) return;
    await supabase.from('tasks').delete().eq('client_id', clientId).eq('user_id', userId);
    await supabase.from('retainer_payments').delete().eq('client_id', clientId).eq('user_id', userId);
    const { error: err } = await supabase.from('clients').delete().eq('id', clientId).eq('user_id', userId);

    if (err) { setError(err.message); return; }

    setClients((prev) => prev.filter((c) => c.id !== clientId));
  }, [userId]);

  // Update client retainer amount (and optionally currency)
  const updateRetainer = useCallback(async (clientId, retainer, retainer_currency) => {
    if (IS_DEMO || !userId) return;
    const updates = { retainer };
    if (retainer_currency) updates.retainer_currency = retainer_currency;
    const { error: err } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .eq('user_id', userId);

    if (err) { setError(err.message); return; }

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, retainer, ...(retainer_currency ? { retainer_currency } : {}) } : c))
    );
  }, [userId]);

  // Toggle retainer paid for a given month
  const toggleRetainerPaid = useCallback(async (clientId, month, paid) => {
    if (IS_DEMO || !userId) return;
    // Check if a record already exists for this client+month
    const { data: existing } = await supabase
      .from('retainer_payments')
      .select('id')
      .eq('client_id', clientId)
      .eq('month', month)
      .eq('user_id', userId)
      .maybeSingle();

    let err;
    if (existing) {
      ({ error: err } = await supabase
        .from('retainer_payments')
        .update({ paid })
        .eq('id', existing.id)
        .eq('user_id', userId));
    } else {
      ({ error: err } = await supabase
        .from('retainer_payments')
        .insert({ client_id: clientId, month, paid, user_id: userId }));
    }

    if (err) { setError(err.message); return; }

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        return { ...c, retainerPaid: { ...c.retainerPaid, [month]: paid } };
      })
    );
  }, [userId]);

  // Add a task
  const addTask = useCallback(async (clientId, title, currency = 'NGN') => {
    if (IS_DEMO || !userId) return;
    // Compute sort_order as max existing + 1 so new tasks go to the end
    const existingClient = clientsRef.current.find((c) => c.id === clientId);
    const maxSort = existingClient && existingClient.tasks.length > 0
      ? Math.max(...existingClient.tasks.map((t) => t.sort_order ?? 0)) + 1
      : 0;

    const { data, error: err } = await supabase
      .from('tasks')
      .insert({ client_id: clientId, title, done: false, paid: false, amount: 0, currency, sort_order: maxSort, user_id: userId })
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
  }, [userId]);

  // Update a task
  const updateTask = useCallback(async (clientId, taskId, updates) => {
    if (IS_DEMO || !userId) return;
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
      .eq('id', taskId)
      .eq('user_id', userId);

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
  }, [userId]);

  // Reorder tasks within a client — saves sort_order to DB
  const reorderTasks = useCallback(async (clientId, orderedIds) => {
    if (IS_DEMO || !userId) return;
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
        supabase.from('tasks').update({ sort_order: i }).eq('id', id).eq('user_id', userId)
      )
    );
  }, [userId]);

  // Delete a task
  const deleteTask = useCallback(async (clientId, taskId) => {
    if (IS_DEMO || !userId) return;
    const { error: err } = await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', userId);

    if (err) { setError(err.message); return; }

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
      })
    );
  }, [userId]);

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
