'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Workspace, WorkspaceRole } from '@/types/team'

interface WorkspaceState {
  workspace: Workspace | null
  role:      WorkspaceRole | null
  loading:   boolean
  error:     string | null
  refetch:   () => void
}

/**
 * Resolves the current user's workspace and their role within it. A user
 * belongs to exactly one workspace today (the one backfilled from their owner
 * account, or one they were invited into). RLS guarantees they only ever see
 * memberships they're part of.
 */
export function useWorkspace(): WorkspaceState {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role,      setRole]      = useState<WorkspaceRole | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const fetchWorkspace = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: membership, error: mErr } = await supabase
        .from('workspace_members')
        .select('role, workspace_id, workspaces ( id, name, slug, owner_id, created_at )')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (mErr) throw mErr

      if (!membership) { setWorkspace(null); setRole(null); setError(null); return }

      const row = membership as unknown as {
        role: WorkspaceRole
        workspaces: Workspace | Workspace[] | null
      }
      const ws = Array.isArray(row.workspaces) ? row.workspaces[0] ?? null : row.workspaces
      setWorkspace(ws)
      setRole(row.role)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void fetchWorkspace() }, [fetchWorkspace])

  return { workspace, role, loading, error, refetch: fetchWorkspace }
}
