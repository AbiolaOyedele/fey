'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { activeWorkspaceSlug } from '@/utils/host'
import { canManageTeam, type Workspace, type WorkspaceRole } from '@/types/team'

export interface WorkspaceMembership {
  workspace: Workspace
  role:      WorkspaceRole
}

interface WorkspaceState {
  /** The active workspace — the one matching the current subdomain, else the first. */
  workspace: Workspace | null
  role:      WorkspaceRole | null
  /** True for owner/admin of the active workspace — gates manage actions. */
  canManage: boolean
  /** Every workspace the user belongs to (for the switcher). */
  memberships: WorkspaceMembership[]
  loading:   boolean
  error:     string | null
  refetch:   () => void
}

/**
 * Loads all workspaces the user belongs to and resolves the ACTIVE one from the
 * current subdomain (<slug>.theruff.agency). On localhost / apex it falls back
 * to the first membership. RLS guarantees the user only sees their own
 * memberships.
 */
export function useWorkspace(): WorkspaceState {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchWorkspaces = useCallback(async () => {
    if (!user) { setMemberships([]); setLoading(false); return }
    setLoading(true)
    try {
      const { data, error: mErr } = await supabase
        .from('workspace_members')
        .select('role, workspaces ( id, name, slug, owner_id, created_at )')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (mErr) throw mErr

      const rows = (data ?? []) as unknown as Array<{ role: WorkspaceRole; workspaces: Workspace | Workspace[] | null }>
      const list: WorkspaceMembership[] = rows
        .map((r) => {
          const ws = Array.isArray(r.workspaces) ? r.workspaces[0] ?? null : r.workspaces
          return ws ? { workspace: ws, role: r.role } : null
        })
        .filter((m): m is WorkspaceMembership => m !== null)

      setMemberships(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void fetchWorkspaces() }, [fetchWorkspaces])

  const active = useMemo<WorkspaceMembership | null>(() => {
    if (memberships.length === 0) return null
    const slug = activeWorkspaceSlug()
    if (slug) {
      const match = memberships.find((m) => m.workspace.slug === slug)
      if (match) return match
    }
    return memberships[0]
  }, [memberships])

  return {
    workspace: active?.workspace ?? null,
    role:      active?.role ?? null,
    canManage: canManageTeam(active?.role ?? null),
    memberships,
    loading,
    error,
    refetch: fetchWorkspaces,
  }
}
