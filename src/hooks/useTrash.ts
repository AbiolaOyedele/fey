'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getActiveWorkspaceId, getEffectiveOwnerId } from '@/lib/active-workspace'

export type TrashKind = 'project' | 'task' | 'client'

export interface TrashEntry {
  id: string
  kind: TrashKind
  title: string
  deletedAt: string
}

const TABLE: Record<TrashKind, string> = {
  project: 'projects',
  task: 'work_tasks',
  client: 'crm_contacts',
}

/**
 * Loads soft-deleted projects, tasks and clients for the active workspace and
 * supports restoring them (clear deleted_at) or permanently deleting them.
 * Soft delete keeps the original row + ID, so a restore brings back all the
 * item's children (a project's messages/files, a client's everything) intact.
 */
export function useTrash() {
  const [entries, setEntries] = useState<TrashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const wsId = await getActiveWorkspaceId()
      const ownerId = await getEffectiveOwnerId()
      const col = wsId ? 'workspace_id' : 'owner_id'
      const val = wsId ?? ownerId ?? ''

      const [projects, tasks, clients] = await Promise.all([
        supabase.from('projects').select('id, title, deleted_at').not('deleted_at', 'is', null).eq(col, val),
        supabase.from('work_tasks').select('id, title, deleted_at').not('deleted_at', 'is', null).eq(col, val),
        supabase.from('crm_contacts').select('id, name, deleted_at').not('deleted_at', 'is', null).eq(col, val),
      ])

      const rows: TrashEntry[] = [
        ...((projects.data ?? []) as { id: string; title: string; deleted_at: string }[]).map((p) => ({ id: p.id, kind: 'project' as const, title: p.title || 'Untitled project', deletedAt: p.deleted_at })),
        ...((tasks.data ?? []) as { id: string; title: string; deleted_at: string }[]).map((t) => ({ id: t.id, kind: 'task' as const, title: t.title || 'Untitled task', deletedAt: t.deleted_at })),
        ...((clients.data ?? []) as { id: string; name: string; deleted_at: string }[]).map((c) => ({ id: c.id, kind: 'client' as const, title: c.name || 'Unnamed client', deletedAt: c.deleted_at })),
      ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())

      setEntries(rows)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the recycle bin')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refetch() }, [refetch])

  const restore = useCallback(async (kind: TrashKind, id: string) => {
    const { error: err } = await supabase.from(TABLE[kind]).update({ deleted_at: null }).eq('id', id)
    if (err) throw err
    setEntries((prev) => prev.filter((e) => !(e.kind === kind && e.id === id)))
  }, [])

  const purge = useCallback(async (kind: TrashKind, id: string) => {
    const { error: err } = await supabase.from(TABLE[kind]).delete().eq('id', id)
    if (err) throw err
    setEntries((prev) => prev.filter((e) => !(e.kind === kind && e.id === id)))
  }, [])

  return { entries, loading, error, refetch, restore, purge }
}
