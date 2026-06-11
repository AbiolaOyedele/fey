'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { IS_DEMO } from '@/lib/constants'
import type { Invoice } from '@/types'

export function useInvoiceData(userId: string | undefined) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const fetchInvoices = useCallback(async () => {
    if (IS_DEMO || !userId) { setLoading(false); return }
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .eq('app', 'fey')
        .order('created_at', { ascending: false })
      if (err) throw err
      setInvoices((data as Invoice[]) || [])
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes('relation "public"."invoices" does not exist') ||
        msg.includes('"invoices" does not exist') ||
        (err as { code?: string }).code === '42P01'
      ) {
        setError('table_missing')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void fetchInvoices() }, [fetchInvoices])

  const fetchInvoice = useCallback(async (id: string): Promise<{ data?: Invoice; error?: string }> => {
    if (!userId) return { error: 'Not authenticated' }
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()
      if (err) throw err
      return { data: data as Invoice }
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: unknown }).message)
          : String(err)
      return { error: msg }
    }
  }, [userId])

  const createInvoice = useCallback(async (invoiceData: Partial<Invoice>): Promise<{ data?: Invoice; error?: string }> => {
    if (IS_DEMO || !userId) return { error: 'Not available in demo' }
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .insert({ ...invoiceData, user_id: userId, app: 'fey' })
        .select()
        .single()
      if (err) throw err
      const inv = data as Invoice
      setInvoices((prev) => [inv, ...prev])
      return { data: inv }
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: unknown }).message)
          : String(err)
      return { error: msg }
    }
  }, [userId])

  const updateInvoice = useCallback(async (id: string, updates: Partial<Invoice>): Promise<{ data?: Invoice; error?: string }> => {
    if (IS_DEMO || !userId) return { error: 'Not available in demo' }
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
      if (err) throw err
      const inv = data as Invoice
      setInvoices((prev) => prev.map((i) => (i.id === id ? inv : i)))
      return { data: inv }
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: unknown }).message)
          : String(err)
      return { error: msg }
    }
  }, [userId])

  const deleteInvoice = useCallback(async (id: string) => {
    if (IS_DEMO || !userId) return
    await supabase.from('invoices').delete().eq('id', id).eq('user_id', userId)
    setInvoices((prev) => prev.filter((inv) => inv.id !== id))
  }, [userId])

  const markLinkedTasksPaid = useCallback(async (taskIds: string[]) => {
    if (IS_DEMO || !userId || !taskIds.length) return
    await Promise.all(
      taskIds.map((taskId) =>
        supabase.from('tasks').update({ paid: true }).eq('id', taskId).eq('user_id', userId)
      )
    )
  }, [userId])

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
  }
}

export async function fetchPublicInvoice(token: string): Promise<{ data?: Invoice; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('share_token', token)
      .eq('share_enabled', true)
      .single()
    if (error) throw error
    return { data: data as Invoice }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
