'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface CrmPending {
  contactCount:     number
  unreadMessages:   number
  pendingContracts: number
  pendingForms:     number
  loaded:           boolean
}

const EMPTY: CrmPending = {
  contactCount: 0, unreadMessages: 0, pendingContracts: 0, pendingForms: 0, loaded: false,
}

/**
 * Lightweight head-count queries for the owner dashboard: how many CRM clients
 * they have, and how many items are waiting on them (unread client messages,
 * contracts sent-but-unsigned, forms sent-but-unsubmitted).
 */
export function useCrmPending(userId: string | undefined): CrmPending {
  const [pending, setPending] = useState<CrmPending>(EMPTY)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const head = { count: 'exact' as const, head: true }
      const [contacts, msgs, contracts, forms] = await Promise.all([
        supabase.from('crm_contacts').select('id', head).eq('owner_id', userId),
        supabase.from('crm_messages').select('id', head).eq('owner_id', userId).eq('sender_type', 'client').is('read_at', null),
        supabase.from('crm_contracts').select('id', head).eq('owner_id', userId).eq('status', 'sent'),
        supabase.from('crm_forms').select('id', head).eq('owner_id', userId).eq('status', 'sent'),
      ])
      if (cancelled) return
      setPending({
        contactCount:     contacts.count ?? 0,
        unreadMessages:   msgs.count ?? 0,
        pendingContracts: contracts.count ?? 0,
        pendingForms:     forms.count ?? 0,
        loaded:           true,
      })
    })()
    return () => { cancelled = true }
  }, [userId])

  return pending
}
