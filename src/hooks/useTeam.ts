'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkspaceMember, WorkspaceInvite, WorkspaceRole } from '@/types/team'

interface TeamState {
  members:  WorkspaceMember[]
  invites:  WorkspaceInvite[]
  loading:  boolean
  error:    string | null
  invite:   (email: string, role: WorkspaceRole) => Promise<{ invite_url: string }>
  changeRole: (memberId: string, role: WorkspaceRole) => Promise<void>
  removeMember: (memberId: string) => Promise<void>
  revokeInvite: (inviteId: string) => Promise<void>
  refetch:  () => void
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  }
}

async function asError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null) as { error?: { message?: string } } | null
  throw new Error(body?.error?.message ?? 'Request failed')
}

/**
 * Loads the workspace roster + pending invites, and exposes the privileged
 * team actions (invite, change role, remove, revoke). Reads go straight through
 * RLS; mutations go through /api/v1/team where the server re-checks the caller's
 * role before acting.
 */
export function useTeam(workspaceId: string | null): TeamState {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return }
    setLoading(true)
    try {
      const [m, i] = await Promise.all([
        supabase.from('workspace_members').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
        supabase.from('workspace_invites').select('*').eq('workspace_id', workspaceId).eq('status', 'pending').order('created_at', { ascending: false }),
      ])
      if (m.error) throw m.error
      if (i.error) throw i.error
      setMembers((m.data ?? []) as WorkspaceMember[])
      setInvites((i.data ?? []) as WorkspaceInvite[])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const invite = useCallback(async (email: string, role: WorkspaceRole) => {
    const res = await fetch('/api/v1/team/invites', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ workspace_id: workspaceId, email, role }),
    })
    if (!res.ok) await asError(res)
    const data = await res.json() as { invite_url: string }
    await fetchAll()
    return data
  }, [workspaceId, fetchAll])

  const changeRole = useCallback(async (memberId: string, role: WorkspaceRole) => {
    const res = await fetch(`/api/v1/team/members/${memberId}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ role }),
    })
    if (!res.ok) await asError(res)
    await fetchAll()
  }, [fetchAll])

  const removeMember = useCallback(async (memberId: string) => {
    const res = await fetch(`/api/v1/team/members/${memberId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    if (!res.ok) await asError(res)
    await fetchAll()
  }, [fetchAll])

  const revokeInvite = useCallback(async (inviteId: string) => {
    const res = await fetch(`/api/v1/team/invites/${inviteId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    if (!res.ok) await asError(res)
    await fetchAll()
  }, [fetchAll])

  return { members, invites, loading, error, invite, changeRole, removeMember, revokeInvite, refetch: fetchAll }
}
