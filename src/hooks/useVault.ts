'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import type {
  CreateVaultItemPayload, CreateVaultNotePayload,
  UpdateVaultItemPayload, UpdateVaultNotePayload, VaultEntry, VaultFilter,
} from '@/types/vault'

/**
 * The Vault, for either side.
 *
 * `subdomain` decides which endpoints are used: absent means the agency
 * (Supabase bearer token), present means a client in their portal (their own
 * JWT). Both return the same `VaultEntry[]`, so the list component doesn't know
 * or care which side it's rendering — the same arrangement useTaskReview uses.
 *
 * Filtering happens on the client. The whole list is one request and an agency's
 * document count is in the hundreds, not millions; doing it here means typing in
 * the search box doesn't hit the network on every keystroke.
 */
export interface VaultState {
  entries: VaultEntry[]
  /** After filters are applied. */
  visible: VaultEntry[]
  loading: boolean
  error: string | null
  filter: VaultFilter
  setFilter: (next: VaultFilter) => void
  refetch: () => Promise<void>
  /** Agency side only — the portal has no write endpoints. */
  addItem: (payload: CreateVaultItemPayload) => Promise<void>
  updateItem: (id: string, patch: UpdateVaultItemPayload) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  addNote: (payload: CreateVaultNotePayload) => Promise<void>
  updateNote: (id: string, patch: UpdateVaultNotePayload) => Promise<void>
  deleteNote: (id: string) => Promise<void>
}

interface UseVaultArgs {
  /** Set when running inside a client portal. */
  subdomain?: string | undefined
  /** The active workspace, so the agency view resolves the right owner. */
  workspaceId?: string | null | undefined
}

function matches(entry: VaultEntry, filter: VaultFilter): boolean {
  if (filter.kind && filter.kind !== 'all' && entry.kind !== filter.kind) return false
  if (filter.category && filter.category !== 'all' && entry.category !== filter.category) return false
  if (filter.contact_id && entry.contact_id !== filter.contact_id) return false
  if (filter.search) {
    const q = filter.search.toLowerCase()
    // Notes are searched by their whole body, not just the title — the reason
    // to write something down is being able to find it by a word from inside it.
    const haystack = [entry.title, entry.subtitle, entry.file_name, entry.contact_name, entry.body]
      .filter(Boolean).join(' ').toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}

export function useVault({ subdomain, workspaceId }: UseVaultArgs = {}): VaultState {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<VaultFilter>({})

  const isPortal = !!subdomain
  const base = isPortal ? '/api/v1/portal/vault' : '/api/v1/vault'

  /** Portal calls carry the client's own JWT; agency calls go through apiFetch. */
  const call = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!isPortal) return apiFetch<T>(path, init)
    const token = localStorage.getItem(portalTokenKey(subdomain!))
    if (!token) throw new Error('Your session has expired. Please sign in again.')
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (init?.body) headers.set('Content-Type', 'application/json')
    const res = await fetch(path, { ...init, headers })
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new Error(b?.error?.message ?? 'Something went wrong. Please try again.')
    }
    return res.json() as Promise<T>
  }, [isPortal, subdomain])

  const refetch = useCallback(async () => {
    try {
      const qs = !isPortal && workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
      const { entries: e } = await call<{ entries: VaultEntry[] }>(`${base}${qs}`)
      setEntries(e)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t load your documents.')
    } finally {
      setLoading(false)
    }
  }, [base, call, isPortal, workspaceId])

  useEffect(() => {
    // Loading a list IS synchronising with an external system; the rule fires
    // only because the fetch starts synchronously rather than from a callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch()
  }, [refetch])

  const addItem = useCallback(async (payload: CreateVaultItemPayload) => {
    await call(base, {
      method: 'POST',
      body: JSON.stringify({ ...payload, ...(workspaceId ? { workspace_id: workspaceId } : {}) }),
    })
    await refetch()
  }, [base, call, refetch, workspaceId])

  const updateItem = useCallback(async (id: string, patch: UpdateVaultItemPayload) => {
    await call(`${base}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...patch, ...(workspaceId ? { workspace_id: workspaceId } : {}) }),
    })
    await refetch()
  }, [base, call, refetch, workspaceId])

  const deleteItem = useCallback(async (id: string) => {
    const qs = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
    await call(`${base}/${id}${qs}`, { method: 'DELETE' })
    // Dropped locally rather than refetched: one row left a list of many, and
    // the round trip would only confirm what the server already accepted.
    setEntries((cur) => cur.filter((e) => !(e.kind === 'file' && e.id === id)))
  }, [base, call, workspaceId])

  // ── Notes ─────────────────────────────────────────────────────────────────
  // Written here rather than uploaded, so they have their own endpoints. The
  // list they come back in is the same one.

  const addNote = useCallback(async (payload: CreateVaultNotePayload) => {
    await call(`${base}/notes`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, ...(workspaceId ? { workspace_id: workspaceId } : {}) }),
    })
    await refetch()
  }, [base, call, refetch, workspaceId])

  const updateNote = useCallback(async (id: string, patch: UpdateVaultNotePayload) => {
    await call(`${base}/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...patch, ...(workspaceId ? { workspace_id: workspaceId } : {}) }),
    })
    await refetch()
  }, [base, call, refetch, workspaceId])

  const deleteNote = useCallback(async (id: string) => {
    const qs = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
    await call(`${base}/notes/${id}${qs}`, { method: 'DELETE' })
    // Dropped locally for the same reason as an item — see above.
    setEntries((cur) => cur.filter((e) => !(e.kind === 'note' && e.id === id)))
  }, [base, call, workspaceId])

  const visible = useMemo(() => entries.filter((e) => matches(e, filter)), [entries, filter])

  return {
    entries, visible, loading, error, filter, setFilter, refetch,
    addItem, updateItem, deleteItem,
    addNote, updateNote, deleteNote,
  }
}
