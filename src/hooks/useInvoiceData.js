import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

export function useInvoiceData(userId) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvoices = useCallback(async () => {
    if (IS_DEMO || !userId) { setLoading(false); return; }
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setInvoices(data || []);
      setError(null);
    } catch (err) {
      if (err.message?.includes('relation "public"."invoices" does not exist') ||
          err.message?.includes('"invoices" does not exist') ||
          err.code === '42P01') {
        setError('table_missing');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const fetchInvoice = useCallback(async (id) => {
    if (!userId) return { error: 'Not authenticated' };
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      if (err) throw err;
      return { data };
    } catch (err) {
      return { error: err.message };
    }
  }, [userId]);

  const createInvoice = useCallback(async (invoiceData) => {
    if (IS_DEMO || !userId) return { error: 'Not available in demo' };
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .insert({ ...invoiceData, user_id: userId })
        .select()
        .single();
      if (err) throw err;
      setInvoices((prev) => [data, ...prev]);
      return { data };
    } catch (err) {
      return { error: err.message };
    }
  }, [userId]);

  const updateInvoice = useCallback(async (id, updates) => {
    if (IS_DEMO || !userId) return { error: 'Not available in demo' };
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (err) throw err;
      setInvoices((prev) => prev.map((inv) => inv.id === id ? data : inv));
      return { data };
    } catch (err) {
      return { error: err.message };
    }
  }, [userId]);

  const deleteInvoice = useCallback(async (id) => {
    if (IS_DEMO || !userId) return;
    await supabase.from('invoices').delete().eq('id', id).eq('user_id', userId);
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  }, [userId]);

  // Mark linked tasks as paid in the tasks table
  const markLinkedTasksPaid = useCallback(async (taskIds) => {
    if (IS_DEMO || !userId || !taskIds?.length) return;
    await Promise.all(
      taskIds.map((taskId) =>
        supabase.from('tasks').update({ paid: true }).eq('id', taskId).eq('user_id', userId)
      )
    );
  }, [userId]);

  return {
    invoices,
    loading,
    error,
    fetchInvoices,
    fetchInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    markLinkedTasksPaid,
  };
}

// Fetch a public invoice by share token (no auth required)
export async function fetchPublicInvoice(token) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('share_token', token)
      .eq('share_enabled', true)
      .single();
    if (error) throw error;
    return { data };
  } catch (err) {
    return { error: err.message };
  }
}
