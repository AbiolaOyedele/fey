import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const CLIENT_NAMES = [
  'Teemplot', 'Wimly', 'SNT', 'Bigbelly', "Kim's Secret",
  'Zero to 16', 'FFDM', 'Bioclean', 'IPC',
];

const PALETTE = [
  '#FDE8E8', '#FEF3C7', '#D1FAE5', '#DBEAFE', '#EDE9FE',
  '#FCE7F3', '#ECFDF5', '#FFF7ED', '#F0FDF4',
];

const SAMPLE_TASKS = {
  Teemplot: [
    { title: 'Design landing page mockup', done: true, paid: true, amount: 75000 },
    { title: 'Build responsive navbar', done: true, paid: true, amount: 40000 },
    { title: 'Set up analytics dashboard', done: false, paid: false, amount: 60000 },
    { title: 'Create brand style guide', done: true, paid: false, amount: 50000 },
  ],
  Wimly: [
    { title: 'Logo redesign concepts', done: true, paid: true, amount: 80000 },
    { title: 'Social media templates', done: true, paid: true, amount: 35000 },
    { title: 'Email newsletter design', done: false, paid: false, amount: 25000 },
  ],
  SNT: [
    { title: 'Product photography editing', done: true, paid: true, amount: 45000 },
    { title: 'E-commerce store setup', done: true, paid: false, amount: 120000 },
    { title: 'SEO optimization', done: false, paid: false, amount: 55000 },
  ],
  Bigbelly: [
    { title: 'Mobile app wireframes', done: true, paid: true, amount: 90000 },
    { title: 'User flow diagrams', done: true, paid: true, amount: 30000 },
    { title: 'Prototype testing report', done: true, paid: false, amount: 40000 },
    { title: 'Final UI kit delivery', done: false, paid: false, amount: 65000 },
  ],
  "Kim's Secret": [
    { title: 'Instagram content calendar', done: true, paid: true, amount: 20000 },
    { title: 'Brand photoshoot direction', done: true, paid: true, amount: 100000 },
    { title: 'Packaging design v2', done: false, paid: false, amount: 70000 },
  ],
  'Zero to 16': [
    { title: 'Course platform customization', done: true, paid: true, amount: 150000 },
    { title: 'Student dashboard UI', done: false, paid: false, amount: 80000 },
  ],
  FFDM: [
    { title: 'Event poster design', done: true, paid: true, amount: 15000 },
    { title: 'Flyer layout for launch', done: true, paid: true, amount: 15000 },
    { title: 'Social media ad creatives', done: true, paid: false, amount: 35000 },
  ],
  Bioclean: [
    { title: 'Website redesign proposal', done: true, paid: true, amount: 50000 },
    { title: 'Product label design', done: true, paid: true, amount: 40000 },
    { title: 'Corporate presentation deck', done: false, paid: false, amount: 60000 },
  ],
  IPC: [
    { title: 'Annual report layout', done: true, paid: true, amount: 85000 },
    { title: 'Internal newsletter template', done: false, paid: false, amount: 25000 },
  ],
};

function randomDate(monthsBack) {
  const d = new Date();
  d.setMonth(d.getMonth() - Math.floor(Math.random() * monthsBack));
  d.setDate(Math.floor(Math.random() * 28) + 1);
  return d.toISOString();
}

async function seedDatabase() {
  for (let i = 0; i < CLIENT_NAMES.length; i++) {
    const name = CLIENT_NAMES[i];
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({ name, color: PALETTE[i], retainer: 0 })
      .select()
      .single();

    if (clientError) continue;

    const tasks = SAMPLE_TASKS[name] || [];
    if (tasks.length > 0) {
      const taskRows = tasks.map((t) => ({
        client_id: client.id,
        title: t.title,
        done: t.done,
        paid: t.paid,
        amount: t.amount,
        created_at: randomDate(3),
      }));
      await supabase.from('tasks').insert(taskRows);
    }
  }
}

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

      // Seed if empty
      if (clientsRes.data.length === 0) {
        await seedDatabase();
        // Re-fetch after seeding
        const [c2, t2, r2] = await Promise.all([
          supabase.from('clients').select('*').order('created_at'),
          supabase.from('tasks').select('*').order('created_at'),
          supabase.from('retainer_payments').select('*'),
        ]);
        setClients(transformClients(c2.data || [], t2.data || [], r2.data || []));
      } else {
        setClients(transformClients(clientsRes.data, tasksRes.data || [], retainerRes.data || []));
      }

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
  const addTask = useCallback(async (clientId, title) => {
    const { data, error: err } = await supabase
      .from('tasks')
      .insert({ client_id: clientId, title, done: false, paid: false, amount: 0 })
      .select()
      .single();

    if (err) { setError(err.message); return; }

    const newTask = {
      id: data.id,
      title: data.title,
      done: data.done,
      paid: data.paid,
      amount: Number(data.amount) || 0,
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
