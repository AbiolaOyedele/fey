'use client'

/**
 * useCrm — Direct Supabase client hooks.
 *
 * WHY DIRECT:
 * The original pattern went through Next.js API routes:
 *   client → getSession() → fetch(/api/v1/crm/...) → serverless cold-start →
 *   requireAuth() → Supabase query
 *
 * That is 3 serial network hops per read. RLS policies (owner_id = auth.uid())
 * enforce the same ownership check at the DB level, so the API routes added
 * latency with no security benefit for CRUD operations.
 *
 * sendContract and sendForm still use API routes — they need RESEND_API_KEY
 * which is a server-only secret.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getEffectiveOwnerId, getActiveWorkspaceId } from '@/lib/active-workspace'
import type {
  CrmContact, CrmMessage, CrmFile, CrmContract, CrmForm, CrmNotification,
  ContractContent, FormField, FormResponse, MessageAttachment,
  CreateContactPayload, UpdateContactPayload,
  UpdateContractPayload, UpdateFormPayload,
} from '@/types/crm'

// ── Auth helper (reads from local cache — no network) ─────────────────────────

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}


/** Used only for the two send operations that need a server secret. */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession()
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init?.headers,
    },
  })
  const json = await res.json() as Record<string, unknown>
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined
    throw new Error(err?.message ?? 'Request failed')
  }
  return json as T
}

// ── Row mappers (match what the repository used to return) ────────────────────

function rowToMessage(row: Record<string, unknown>): CrmMessage {
  return {
    id:          row.id as string,
    contact_id:  row.contact_id as string,
    owner_id:    row.owner_id as string,
    sender_type: row.sender_type as 'owner' | 'client',
    sender_id:   row.sender_id as string,
    body:        row.body as string,
    body_html:   (row.body_html as string | null) ?? null,
    attachments: (row.attachments as MessageAttachment[]) ?? [],
    read_at:     (row.read_at as string | null) ?? null,
    created_at:  row.created_at as string,
  }
}

function rowToContract(row: Record<string, unknown>): CrmContract {
  return {
    id:          row.id as string,
    contact_id:  row.contact_id as string,
    owner_id:    row.owner_id as string,
    title:       row.title as string,
    share_token: row.share_token as string,
    status:      row.status as CrmContract['status'],
    content:     row.content as ContractContent,
    signed_at:   (row.signed_at as string | null) ?? null,
    created_at:  row.created_at as string,
    updated_at:  row.updated_at as string,
  }
}

function rowToForm(row: Record<string, unknown>): CrmForm {
  return {
    id:           row.id as string,
    contact_id:   row.contact_id as string,
    owner_id:     row.owner_id as string,
    title:        row.title as string,
    share_token:  row.share_token as string,
    status:       row.status as CrmForm['status'],
    fields:       (row.fields as FormField[]) ?? [],
    responses:    (row.responses as FormResponse[]) ?? [],
    submitted_at: (row.submitted_at as string | null) ?? null,
    created_at:   row.created_at as string,
    updated_at:   row.updated_at as string,
  }
}

// ── useContacts ───────────────────────────────────────────────────────────────

export function useContacts() {
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) { setLoading(false); return }
      // Scope to the active workspace; fall back to owner only if the workspace
      // can't be resolved yet (e.g. mid-onboarding).
      const wsId = await getActiveWorkspaceId()
      let q = supabase.from('crm_contacts').select('*')
      q = wsId ? q.eq('workspace_id', wsId) : q.eq('owner_id', await getEffectiveOwnerId())
      const { data, error: err } = await q.order('created_at', { ascending: false })
      if (err) throw err
      let rows = (data ?? []) as CrmContact[]

      // Merge in each client's last portal activity (best-effort)
      try {
        const res = await fetch('/api/v1/crm/activity', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const { activity } = await res.json() as { activity: Record<string, string> }
          rows = rows.map((c) => ({ ...c, last_seen_at: activity[c.id] ?? null }))
        }
      } catch { /* activity is optional — show contacts regardless */ }

      setContacts(rows)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchContacts() }, [fetchContacts])

  const createContact = useCallback(async (payload: CreateContactPayload) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('crm_contacts')
      .insert({ ...payload, owner_id: await getEffectiveOwnerId(), workspace_id: await getActiveWorkspaceId() })
      .select()
      .single()
    if (err) throw err
    const contact = data as CrmContact
    setContacts((prev) => [contact, ...prev])
    return contact
  }, [])

  const updateContact = useCallback(async (id: string, payload: UpdateContactPayload) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('crm_contacts')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', await getEffectiveOwnerId())
      .select()
      .single()
    if (err) throw err
    const contact = data as CrmContact
    setContacts((prev) => prev.map((c) => c.id === id ? contact : c))
    return contact
  }, [])

  const deleteContact = useCallback(async (id: string) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { error: err } = await supabase
      .from('crm_contacts')
      .delete()
      .eq('id', id)
      .eq('owner_id', await getEffectiveOwnerId())
    if (err) throw err
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  /** Archives (or unarchives) a client. Hides from default views; reversible. */
  const setContactArchived = useCallback(async (id: string, archived: boolean) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const archived_at = archived ? new Date().toISOString() : null
    const { error: err } = await supabase
      .from('crm_contacts')
      .update({ archived_at, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', await getEffectiveOwnerId())
    if (err) throw err
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, archived_at } : c))
  }, [])

  return {
    contacts, loading, error, fetchContacts,
    createContact, updateContact, deleteContact, setContactArchived,
  }
}

// ── useMessages ───────────────────────────────────────────────────────────────

export function useMessages(contactId: string | null) {
  const [messages, setMessages] = useState<CrmMessage[]>([])
  const [loading,  setLoading]  = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!contactId) return
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const { data, error: err } = await supabase
        .from('crm_messages')
        .select('*')
        .eq('contact_id', contactId)
        .eq('owner_id', await getEffectiveOwnerId())
        .order('created_at', { ascending: true })
      if (err) throw err
      setMessages((data ?? []).map((r) => rowToMessage(r as Record<string, unknown>)))

      // Mark unread client messages as read (fire-and-forget)
      void supabase
        .from('crm_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('contact_id', contactId)
        .eq('owner_id', await getEffectiveOwnerId())
        .is('read_at', null)
        .neq('sender_type', 'owner')
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => {
    void fetchMessages()
    if (!contactId) return

    // Realtime subscription — unchanged
    const channel = supabase
      .channel(`crm-messages-${contactId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_messages', filter: `contact_id=eq.${contactId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const msg = rowToMessage(row)
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'crm_messages', filter: `contact_id=eq.${contactId}` },
        (payload) => {
          // Catches read_at flipping when the client opens the thread, so the
          // owner's "Sent" → "Read" indicator updates live.
          const msg = rowToMessage(payload.new as Record<string, unknown>)
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
        })
      .subscribe()
    channelRef.current = channel
    return () => { if (channelRef.current) void supabase.removeChannel(channelRef.current) }
  }, [contactId, fetchMessages])

  const sendMessage = useCallback(async (body: string, bodyHtml: string | null, attachments: MessageAttachment[] = []) => {
    if (!contactId) return
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('crm_messages')
      .insert({
        contact_id:   contactId,
        owner_id:     await getEffectiveOwnerId(),
        workspace_id: await getActiveWorkspaceId(),
        sender_type:  'owner',
        sender_id:    session.user.id,
        body,
        body_html:    bodyHtml ?? null,
        attachments,
      })
      .select()
      .single()
    if (err) throw err
    return rowToMessage(data as Record<string, unknown>)
  }, [contactId])

  return { messages, loading, sendMessage, refetch: fetchMessages }
}

// ── useCrmFiles ───────────────────────────────────────────────────────────────

export function useCrmFiles(contactId: string | null) {
  const [files,   setFiles]   = useState<CrmFile[]>([])
  const [loading, setLoading] = useState(false)

  const fetchFiles = useCallback(async () => {
    if (!contactId) return
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const { data, error: err } = await supabase
        .from('crm_files')
        .select('*')
        .eq('contact_id', contactId)
        .eq('owner_id', await getEffectiveOwnerId())
        .order('created_at', { ascending: false })
      if (err) throw err
      setFiles((data ?? []) as CrmFile[])
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => { void fetchFiles() }, [fetchFiles])

  const addFile = useCallback(async (payload: Omit<CrmFile, 'id' | 'created_at' | 'owner_id' | 'uploaded_by'>) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('crm_files')
      .insert({ ...payload, owner_id: await getEffectiveOwnerId(), workspace_id: await getActiveWorkspaceId(), uploaded_by: session.user.id })
      .select()
      .single()
    if (err) throw err
    const file = data as CrmFile
    setFiles((prev) => [file, ...prev])
    return file
  }, [])

  const removeFile = useCallback(async (id: string) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { error: err } = await supabase
      .from('crm_files')
      .delete()
      .eq('id', id)
      .eq('owner_id', await getEffectiveOwnerId())
    if (err) throw err
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  return { files, loading, addFile, removeFile, refetch: fetchFiles }
}

// ── useContracts ──────────────────────────────────────────────────────────────

export function useContracts(contactId: string | null) {
  const [contracts, setContracts] = useState<CrmContract[]>([])
  const [loading,   setLoading]   = useState(false)

  const fetchContracts = useCallback(async () => {
    if (!contactId) return
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const { data, error: err } = await supabase
        .from('crm_contracts')
        .select('*')
        .eq('contact_id', contactId)
        .eq('owner_id', await getEffectiveOwnerId())
        .order('created_at', { ascending: false })
      if (err) throw err
      setContracts((data ?? []).map((r) => rowToContract(r as Record<string, unknown>)))
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => { void fetchContracts() }, [fetchContracts])

  const createContract = useCallback(async (title: string) => {
    if (!contactId) throw new Error('No contact selected')
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const content: ContractContent = {
      body: '', body_html: '', effective_date: null, expiry_date: null, signature_block: '',
    }
    const { data, error: err } = await supabase
      .from('crm_contracts')
      .insert({ contact_id: contactId, owner_id: await getEffectiveOwnerId(), workspace_id: await getActiveWorkspaceId(), title, content })
      .select()
      .single()
    if (err) throw err
    const contract = rowToContract(data as Record<string, unknown>)
    setContracts((prev) => [contract, ...prev])
    return contract
  }, [contactId])

  const updateContract = useCallback(async (id: string, payload: UpdateContractPayload) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('crm_contracts')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', await getEffectiveOwnerId())
      .select()
      .single()
    if (err) throw err
    const contract = rowToContract(data as Record<string, unknown>)
    setContracts((prev) => prev.map((c) => c.id === id ? contract : c))
    return contract
  }, [])

  const deleteContract = useCallback(async (id: string) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { error: err } = await supabase
      .from('crm_contracts')
      .delete()
      .eq('id', id)
      .eq('owner_id', await getEffectiveOwnerId())
    if (err) throw err
    setContracts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // sendContract still uses the API route — needs RESEND_API_KEY server secret
  const sendContract = useCallback(async (id: string, to: string) => {
    const { contract } = await apiFetch<{ contract: CrmContract }>(`/api/v1/crm/contracts/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    })
    const mapped = rowToContract(contract as unknown as Record<string, unknown>)
    setContracts((prev) => prev.map((c) => c.id === id ? mapped : c))
    return mapped
  }, [])

  return { contracts, loading, createContract, updateContract, deleteContract, sendContract, refetch: fetchContracts }
}

// ── useForms ──────────────────────────────────────────────────────────────────

export function useForms(contactId: string | null) {
  const [forms,   setForms]   = useState<CrmForm[]>([])
  const [loading, setLoading] = useState(false)

  const fetchForms = useCallback(async () => {
    if (!contactId) return
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const { data, error: err } = await supabase
        .from('crm_forms')
        .select('*')
        .eq('contact_id', contactId)
        .eq('owner_id', await getEffectiveOwnerId())
        .order('created_at', { ascending: false })
      if (err) throw err
      setForms((data ?? []).map((r) => rowToForm(r as Record<string, unknown>)))
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => { void fetchForms() }, [fetchForms])

  const createForm = useCallback(async (title: string) => {
    if (!contactId) throw new Error('No contact selected')
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('crm_forms')
      .insert({ contact_id: contactId, owner_id: await getEffectiveOwnerId(), workspace_id: await getActiveWorkspaceId(), title, fields: [] })
      .select()
      .single()
    if (err) throw err
    const form = rowToForm(data as Record<string, unknown>)
    setForms((prev) => [form, ...prev])
    return form
  }, [contactId])

  const updateForm = useCallback(async (id: string, payload: UpdateFormPayload) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('crm_forms')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', await getEffectiveOwnerId())
      .select()
      .single()
    if (err) throw err
    const form = rowToForm(data as Record<string, unknown>)
    setForms((prev) => prev.map((f) => f.id === id ? form : f))
    return form
  }, [])

  const deleteForm = useCallback(async (id: string) => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const { error: err } = await supabase
      .from('crm_forms')
      .delete()
      .eq('id', id)
      .eq('owner_id', await getEffectiveOwnerId())
    if (err) throw err
    setForms((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // sendForm still uses the API route — needs RESEND_API_KEY server secret
  const sendForm = useCallback(async (id: string, to: string) => {
    const { form } = await apiFetch<{ form: CrmForm }>(`/api/v1/crm/forms/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    })
    const mapped = rowToForm(form as unknown as Record<string, unknown>)
    setForms((prev) => prev.map((f) => f.id === id ? mapped : f))
    return mapped
  }, [])

  return { forms, loading, createForm, updateForm, deleteForm, sendForm, refetch: fetchForms }
}

// ── useNotifications ──────────────────────────────────────────────────────────

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<CrmNotification[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!userId) return

    // Direct query — no API hop
    void supabase
      .from('crm_notifications')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setNotifications((data ?? []) as CrmNotification[]))

    const channel = supabase
      .channel(`crm-notifications-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_notifications', filter: `owner_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as CrmNotification, ...prev])
        })
      .subscribe()
    channelRef.current = channel
    return () => { if (channelRef.current) void supabase.removeChannel(channelRef.current) }
  }, [userId])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    const { error: err } = await supabase
      .from('crm_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('owner_id', userId)
      .is('read_at', null)
    if (!err) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    }
  }, [userId])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return { notifications, unreadCount, markAllRead }
}
