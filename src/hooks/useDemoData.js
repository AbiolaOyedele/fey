import { useState, useCallback, useRef, useEffect } from 'react';
import { DEMO_CLIENTS, DEMO_GROUPS, DEMO_STANDALONE_TASKS } from '../data/demoData';

// Simple incrementing ID generator for items added during the demo session
let _idCounter = 9000;
const newId = (prefix) => `${prefix}-new-${++_idCounter}`;

// Deep-clone once on module load so every hook call gets fresh data
const cloneClients       = () => JSON.parse(JSON.stringify(DEMO_CLIENTS));
const cloneGroups        = () => JSON.parse(JSON.stringify(DEMO_GROUPS));
const cloneStandalone    = () => JSON.parse(JSON.stringify(DEMO_STANDALONE_TASKS));

/**
 * useDemoData — manages ALL in-memory demo state.
 *
 * Returns the same shape that App.jsx expects from useSupabaseData()
 * plus a `taskGroupData` field matching the shape from useTaskGroupData().
 *
 * Also exposes trash helper functions that DemoContext wires into SettingsContext
 * so the rest of the app can call useSettings().trashX without touching Supabase.
 */
export function useDemoData() {
  const [clients,         setClients]         = useState(cloneClients);
  const [groups,          setGroups]           = useState(cloneGroups);
  const [standaloneTasks, setStandaloneTasks]  = useState(cloneStandalone);

  // Keep refs in sync for use inside callbacks (avoids stale closure issues)
  const clientsRef    = useRef(clients);
  const groupsRef     = useRef(groups);
  const standaloneRef = useRef(standaloneTasks);
  useEffect(() => { clientsRef.current    = clients;         }, [clients]);
  useEffect(() => { groupsRef.current     = groups;          }, [groups]);
  useEffect(() => { standaloneRef.current = standaloneTasks; }, [standaloneTasks]);

  // ── Client mutations ──────────────────────────────────────────────────────

  const addClient = useCallback((name, color, logo = '') => {
    const id = newId('c');
    setClients((prev) => [
      ...prev,
      { id, name, color, logo, task_mode: false, retainer: 0, retainerPaid: {}, tasks: [] },
    ]);
  }, []);

  const updateClient = useCallback((clientId, updates) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c)));
  }, []);

  const deleteClient = useCallback((clientId) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
  }, []);

  const updateRetainer = useCallback((clientId, retainer) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, retainer } : c)));
  }, []);

  const toggleRetainerPaid = useCallback((clientId, month, paid) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== clientId ? c : { ...c, retainerPaid: { ...c.retainerPaid, [month]: paid } }
      )
    );
  }, []);

  // ── Client-task mutations ─────────────────────────────────────────────────

  const addTask = useCallback((clientId, title, currency = 'NGN') => {
    const id = newId('t');
    const existing = clientsRef.current.find((c) => c.id === clientId);
    const maxSort  = existing?.tasks?.length
      ? Math.max(...existing.tasks.map((t) => t.sort_order ?? 0)) + 1
      : 0;
    const newTask = {
      id, title, done: false, paid: false, amount: 0,
      currency, deadline: null, sort_order: maxSort, createdAt: new Date().toISOString(),
    };
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, tasks: [...c.tasks, newTask] } : c))
    );
  }, []);

  const updateTask = useCallback((clientId, taskId, updates) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== clientId ? c
          : { ...c, tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)) }
      )
    );
  }, []);

  const reorderTasks = useCallback((clientId, orderedIds) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const taskMap = new Map(c.tasks.map((t) => [t.id, t]));
        return { ...c, tasks: orderedIds.map((id, i) => ({ ...taskMap.get(id), sort_order: i })) };
      })
    );
  }, []);

  const deleteTask = useCallback((clientId, taskId) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== clientId ? c : { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
      )
    );
  }, []);

  // ── Trash helpers (called by DemoContext → SettingsContext) ───────────────

  /**
   * trashClient — removes client from local state & returns a fake trash item
   * so App.jsx's showToast fires correctly.
   */
  const trashClient = useCallback((client) => {
    setClients((prev) => prev.filter((c) => c.id !== client.id));
    return { id: `demo-trash-${client.id}` };
  }, []);

  /**
   * trashTask — removes a client task from local state.
   * App.jsx does NOT check the return value so we return nothing.
   */
  const trashTask = useCallback((task, clientId) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== clientId ? c : { ...c, tasks: c.tasks.filter((t) => t.id !== task.id) }
      )
    );
  }, []);

  // ── Group mutations ───────────────────────────────────────────────────────

  const addGroup = useCallback((name, color, icon = '') => {
    const id = newId('g');
    const maxSort = groupsRef.current.length
      ? Math.max(...groupsRef.current.map((g) => g.sort_order ?? 0)) + 1
      : 0;
    setGroups((prev) => [
      ...prev,
      { id, name, color, icon, sort_order: maxSort, createdAt: new Date().toISOString(), tasks: [] },
    ]);
  }, []);

  const updateGroup = useCallback((groupId, updates) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g)));
  }, []);

  const removeGroup = useCallback((groupId) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }, []);

  const reorderGroups = useCallback((orderedIds) => {
    setGroups((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]));
      return orderedIds.map((id, i) => ({ ...map.get(id), sort_order: i }));
    });
  }, []);

  // ── Standalone-task mutations ─────────────────────────────────────────────

  const addStandaloneTask = useCallback((title) => {
    const id = newId('st');
    const maxSort = standaloneRef.current.length
      ? Math.max(...standaloneRef.current.map((t) => t.sort_order ?? 0)) + 1
      : 0;
    setStandaloneTasks((prev) => [
      ...prev,
      { id, title, done: false, deadline: null, sort_order: maxSort, createdAt: new Date().toISOString() },
    ]);
  }, []);

  const updateStandaloneTask = useCallback((taskId, updates) => {
    setStandaloneTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  }, []);

  const removeStandaloneTask = useCallback((taskId) => {
    setStandaloneTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const reorderStandaloneTasks = useCallback((orderedIds) => {
    setStandaloneTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      return orderedIds.map((id, i) => ({ ...map.get(id), sort_order: i }));
    });
  }, []);

  // ── Group-task mutations ──────────────────────────────────────────────────

  const addGroupTask = useCallback((groupId, title) => {
    const id = newId('gt');
    const group    = groupsRef.current.find((g) => g.id === groupId);
    const maxSort  = group?.tasks?.length
      ? Math.max(...group.tasks.map((t) => t.sort_order ?? 0)) + 1
      : 0;
    const newTask = { id, title, done: false, deadline: null, sort_order: maxSort, createdAt: new Date().toISOString() };
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, tasks: [...g.tasks, newTask] } : g))
    );
  }, []);

  const updateGroupTask = useCallback((groupId, taskId, updates) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId ? g
          : { ...g, tasks: g.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)) }
      )
    );
  }, []);

  const reorderGroupTasks = useCallback((groupId, orderedIds) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const taskMap = new Map(g.tasks.map((t) => [t.id, t]));
        return { ...g, tasks: orderedIds.map((id, i) => ({ ...taskMap.get(id), sort_order: i })) };
      })
    );
  }, []);

  /**
   * trashGroup — called AFTER removeGroup() in Tasks.jsx, so the group is
   * already gone from state. We just return a fake item so the toast fires.
   */
  const trashGroup = useCallback((group) => {
    return { id: `demo-trash-${group.id}` };
  }, []);

  /**
   * trashStandaloneTask — handles two cases:
   *   1. Standalone task: Tasks.jsx calls removeStandaloneTask() first, then this.
   *      The task is already gone; we just return a fake item.
   *   2. Group task: TaskGroupWorkspace.jsx calls ONLY this (no prior remove).
   *      We must remove the task from the group.
   */
  const trashStandaloneTask = useCallback((task) => {
    if (task.task_group_id) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id !== task.task_group_id ? g
            : { ...g, tasks: g.tasks.filter((t) => t.id !== task.id) }
        )
      );
    }
    return { id: `demo-trash-${task.id}` };
  }, []);

  // ── Return value ──────────────────────────────────────────────────────────

  return {
    // ── Client data (mirrors useSupabaseData return shape) ──
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
    refetch: () => {}, // no-op — state is always in sync
    trashClient,
    trashTask,

    // ── Task group data (mirrors useTaskGroupData return shape) ──
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
  };
}
