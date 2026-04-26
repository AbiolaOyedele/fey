import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Manages files attached to a single task.
 * Only fetches when `enabled` is true (e.g. when the attachment panel is open).
 */
export function useTaskFiles(taskId, enabled = false) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    const { data } = await supabase
      .from('task_files')
      .select('*')
      .eq('task_id', taskId)
      .is('parent_file_id', null)         // root versions only
      .order('created_at', { ascending: false });
    setFiles(data || []);
    setLoading(false);
  }, [taskId]);

  // Fetch when enabled flips to true
  useEffect(() => {
    if (enabled) fetch();
  }, [enabled, fetch]);

  // Realtime subscription (always active once mounted with a taskId)
  useEffect(() => {
    if (!taskId) return;
    // Use a unique channel name per mount to avoid StrictMode double-invoke conflicts
    const channelName = `task-files-${taskId}-${Date.now()}`;
    let channel;
    try {
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'task_files',
          filter: `task_id=eq.${taskId}`,
        }, () => { if (enabled) fetch(); })
        .subscribe();
    } catch (e) {
      // ignore subscription errors (e.g. StrictMode double-invoke)
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [taskId, enabled, fetch]);

  const addFile = useCallback(async (fileData) => {
    const { data, error } = await supabase
      .from('task_files')
      .insert(fileData)
      .select()
      .single();
    if (!error && data) setFiles((prev) => [data, ...prev]);
    return { data, error };
  }, []);

  const updateStatus = useCallback(async (fileId, status, amendmentNotes = null) => {
    const update = { status };
    if (amendmentNotes !== null) update.amendment_notes = amendmentNotes;
    const { data } = await supabase
      .from('task_files')
      .update(update)
      .eq('id', fileId)
      .select()
      .single();
    if (data) setFiles((prev) => prev.map((f) => f.id === fileId ? data : f));
    return data;
  }, []);

  const deleteFile = useCallback(async (fileId, publicId) => {
    // Delete from Cloudinary via edge function
    try {
      await supabase.functions.invoke('delete-cloudinary-file', {
        body: { public_id: publicId },
      });
    } catch (e) {
      console.warn('Cloudinary delete failed (continuing):', e);
    }
    await supabase.from('task_files').delete().eq('id', fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // Count-only query for badge display (lightweight)
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!taskId) return;
    supabase
      .from('task_files')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', taskId)
      .is('parent_file_id', null)
      .then(({ count: n }) => setCount(n || 0));
  }, [taskId, files.length]);

  return { files, loading, count, refetch: fetch, addFile, updateStatus, deleteFile };
}
