import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Manages all files for a client — both client-level and task-level uploads.
 * Combined and sorted by created_at desc.
 */
export function useClientFiles(clientId) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [cf, tf] = await Promise.all([
      supabase
        .from('client_files')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('task_files')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ]);

    const combined = [
      ...(cf.data || []).map((f) => ({ ...f, _source: 'client' })),
      ...(tf.data || []).map((f) => ({ ...f, _source: 'task' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setFiles(combined);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime: listen to both tables for this client
  useEffect(() => {
    if (!clientId) return;
    const channelName = `client-all-files-${clientId}-${Date.now()}`;
    let channel;
    try {
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'client_files',
          filter: `client_id=eq.${clientId}`,
        }, fetch)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'task_files',
          filter: `client_id=eq.${clientId}`,
        }, fetch)
        .subscribe();
    } catch (e) {
      // ignore StrictMode double-invoke errors
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [clientId, fetch]);

  const addClientFile = useCallback(async (fileData) => {
    const { data, error } = await supabase
      .from('client_files')
      .insert(fileData)
      .select()
      .single();
    if (!error && data) fetch();
    return { data, error };
  }, [fetch]);

  const updateStatus = useCallback(async (fileId, source, status, amendmentNotes = null) => {
    const table = source === 'task' ? 'task_files' : 'client_files';
    const update = { status };
    if (amendmentNotes !== null) update.amendment_notes = amendmentNotes;
    const { data } = await supabase
      .from(table)
      .update(update)
      .eq('id', fileId)
      .select()
      .single();
    if (data) {
      setFiles((prev) =>
        prev.map((f) => f.id === fileId ? { ...data, _source: source } : f)
      );
    }
    return data;
  }, []);

  const deleteFile = useCallback(async (fileId, publicId, source) => {
    try {
      await supabase.functions.invoke('delete-cloudinary-file', {
        body: { public_id: publicId },
      });
    } catch (e) {
      console.warn('Cloudinary delete failed (continuing):', e);
    }
    const table = source === 'task' ? 'task_files' : 'client_files';
    await supabase.from(table).delete().eq('id', fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // Version history for a specific file
  const fetchVersions = useCallback(async (fileId, source) => {
    const table = source === 'task' ? 'task_files' : 'client_files';
    const { data } = await supabase
      .from(table)
      .select('*')
      .or(`id.eq.${fileId},parent_file_id.eq.${fileId}`)
      .order('version', { ascending: true });
    return data || [];
  }, []);

  return {
    files,
    loading,
    refetch: fetch,
    addClientFile,
    updateStatus,
    deleteFile,
    fetchVersions,
  };
}
