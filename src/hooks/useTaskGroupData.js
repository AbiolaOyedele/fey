import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

function transformGroups(groups, tasks) {
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    icon: g.icon || '',
    sort_order: g.sort_order ?? 0,
    createdAt: g.created_at,
    tasks: tasks
      .filter((t) => t.task_group_id === g.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        deadline: t.deadline || null,
        sort_order: t.sort_order ?? 0,
        createdAt: t.created_at,
      })),
  }));
}

export function useTaskGroupData(userId) {
  const [groups, setGroups] = useState([]);
  const [standaloneTasks, setStandaloneTasks] = useState([]);
  const [loading, setLoading] = useState(!IS_DEMO); // false immediately in demo mode
  const [error, setError] = useState(null);
  const groupsRef = useRef([]);
  const standaloneRef = useRef([]);

  useEffect(() => { groupsRef.current = groups; }, [groups]);
  useEffect(() => { standaloneRef.current = standaloneTasks; }, [standaloneTasks]);

  const fetchData = useCallback(async () => {
    if (IS_DEMO) return; // no Supabase reads in demo mode
    if (!userId) return;  // wait until we know who the user is
    try {
      const [groupsRes, tasksRes] = await Promise.all([
        supabase.from('task_groups').select('*').eq('user_id', userId).order('sort_order', { ascending: true }).order('created_at'),
        supabase.from('standalone_tasks').select('*').eq('user_id', userId).order('sort_order', { ascending: true }).order('created_at'),
      ]);
      if (groupsRes.error) throw groupsRes.error;
      if (tasksRes.error) throw tasksRes.error;

      const allTasks = tasksRes.data || [];
      const groupTasks = allTasks.filter((t) => t.task_group_id !== null);
      const solo = allTasks.filter((t) => t.task_group_id === null);

      setGroups(transformGroups(groupsRes.data || [], groupTasks));
      setStandaloneTasks(solo.map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        deadline: t.deadline || null,
        sort_order: t.sort_order ?? 0,
        createdAt: t.created_at,
      })));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Groups ───────────────────────────────────────────────────────────────

  const addGroup = useCallback(async (name, color, icon = '') => {
    if (IS_DEMO || !userId) return;
    const maxSort = groupsRef.current.length > 0
      ? Math.max(...groupsRef.current.map((g) => g.sort_order ?? 0)) + 1
      : 0;
    const { data, error: err } = await supabase
      .from('task_groups')
      .insert({ name, color, icon, sort_order: maxSort, user_id: userId })
      .select().single();
    if (err) { setError(err.message); return; }
    setGroups((prev) => [...prev, {
      id: data.id, name: data.name, color: data.color, icon: data.icon || '',
      sort_order: data.sort_order ?? 0, tasks: [],
    }]);
  }, [userId]);

  const updateGroup = useCallback(async (groupId, updates) => {
    if (IS_DEMO || !userId) return;
    const dbUpdates = {};
    if ('name' in updates) dbUpdates.name = updates.name;
    if ('color' in updates) dbUpdates.color = updates.color;
    if ('icon' in updates) dbUpdates.icon = updates.icon;
    const { error: err } = await supabase.from('task_groups').update(dbUpdates).eq('id', groupId).eq('user_id', userId);
    if (err) { setError(err.message); return; }
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, ...updates } : g));
  }, [userId]);

  const removeGroup = useCallback((groupId) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }, []);

  const reorderGroups = useCallback(async (orderedIds) => {
    if (IS_DEMO || !userId) return;
    setGroups((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]));
      return orderedIds.map((id, i) => ({ ...map.get(id), sort_order: i }));
    });
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('task_groups').update({ sort_order: i }).eq('id', id).eq('user_id', userId)
    ));
  }, [userId]);

  // ─── Standalone tasks ────────────────────────────────────────────────────

  const addStandaloneTask = useCallback(async (title) => {
    if (IS_DEMO || !userId) return;
    const maxSort = standaloneRef.current.length > 0
      ? Math.max(...standaloneRef.current.map((t) => t.sort_order ?? 0)) + 1
      : 0;
    const { data, error: err } = await supabase
      .from('standalone_tasks')
      .insert({ title, done: false, task_group_id: null, sort_order: maxSort, user_id: userId })
      .select().single();
    if (err) { setError(err.message); return; }
    setStandaloneTasks((prev) => [...prev, {
      id: data.id, title: data.title, done: data.done,
      deadline: data.deadline || null, sort_order: data.sort_order ?? 0, createdAt: data.created_at,
    }]);
  }, [userId]);

  const updateStandaloneTask = useCallback(async (taskId, updates) => {
    if (IS_DEMO || !userId) return;
    const dbUpdates = {};
    if ('title' in updates) dbUpdates.title = updates.title;
    if ('done' in updates) dbUpdates.done = updates.done;
    if ('deadline' in updates) dbUpdates.deadline = updates.deadline;
    if ('sort_order' in updates) dbUpdates.sort_order = updates.sort_order;
    const { error: err } = await supabase.from('standalone_tasks').update(dbUpdates).eq('id', taskId).eq('user_id', userId);
    if (err) { setError(err.message); return; }
    setStandaloneTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t));
  }, [userId]);

  const removeStandaloneTask = useCallback((taskId) => {
    setStandaloneTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const reorderStandaloneTasks = useCallback(async (orderedIds) => {
    if (IS_DEMO || !userId) return;
    setStandaloneTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      return orderedIds.map((id, i) => ({ ...map.get(id), sort_order: i }));
    });
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('standalone_tasks').update({ sort_order: i }).eq('id', id).eq('user_id', userId)
    ));
  }, [userId]);

  // ─── Group tasks ──────────────────────────────────────────────────────────

  const addGroupTask = useCallback(async (groupId, title) => {
    if (IS_DEMO || !userId) return;
    const group = groupsRef.current.find((g) => g.id === groupId);
    const maxSort = group && group.tasks.length > 0
      ? Math.max(...group.tasks.map((t) => t.sort_order ?? 0)) + 1
      : 0;
    const { data, error: err } = await supabase
      .from('standalone_tasks')
      .insert({ title, done: false, task_group_id: groupId, sort_order: maxSort, user_id: userId })
      .select().single();
    if (err) { setError(err.message); return; }
    const newTask = {
      id: data.id, title: data.title, done: data.done,
      deadline: data.deadline || null, sort_order: data.sort_order ?? 0, createdAt: data.created_at,
    };
    setGroups((prev) => prev.map((g) =>
      g.id === groupId ? { ...g, tasks: [...g.tasks, newTask] } : g
    ));
  }, [userId]);

  const updateGroupTask = useCallback(async (groupId, taskId, updates) => {
    if (IS_DEMO || !userId) return;
    const dbUpdates = {};
    if ('title' in updates) dbUpdates.title = updates.title;
    if ('done' in updates) dbUpdates.done = updates.done;
    if ('deadline' in updates) dbUpdates.deadline = updates.deadline;
    if ('sort_order' in updates) dbUpdates.sort_order = updates.sort_order;
    const { error: err } = await supabase.from('standalone_tasks').update(dbUpdates).eq('id', taskId).eq('user_id', userId);
    if (err) { setError(err.message); return; }
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, tasks: g.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t) };
    }));
  }, [userId]);

  const removeGroupTask = useCallback((groupId, taskId) => {
    setGroups((prev) => prev.map((g) =>
      g.id === groupId ? { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) } : g
    ));
  }, []);

  const reorderGroupTasks = useCallback(async (groupId, orderedIds) => {
    if (IS_DEMO || !userId) return;
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g;
      const taskMap = new Map(g.tasks.map((t) => [t.id, t]));
      return { ...g, tasks: orderedIds.map((id, i) => ({ ...taskMap.get(id), sort_order: i })) };
    }));
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('standalone_tasks').update({ sort_order: i }).eq('id', id).eq('user_id', userId)
    ));
  }, [userId]);

  return {
    groups,
    standaloneTasks,
    loading,
    error,
    refetch: fetchData,
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
    removeGroupTask,
    reorderGroupTasks,
  };
}
