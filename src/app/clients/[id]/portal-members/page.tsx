'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/contexts/SettingsContext'
import PortalMemberList from '@/components/crm/PortalMemberList'
import type { PortalRole, PortalUser } from '@/types/crm'

/**
 * The owner's view of a client's portal members.
 *
 * Same component and same endpoint semantics as the client's own Members page —
 * the difference is that the owner can always manage, including reassigning a
 * contact's last admin, which the client themselves is blocked from doing.
 */
export default function PortalMembersTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'

  const [members, setMembers] = useState<PortalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const authHeaders = useCallback(async (): Promise<HeadersInit | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [])

  const load = useCallback(async () => {
    const h = await authHeaders()
    if (!h) { setLoading(false); return }
    try {
      const res = await fetch(`/api/v1/crm/portal-members?contact_id=${id}`, { headers: h })
      if (!res.ok) throw new Error('load failed')
      const d = await res.json() as { members: PortalUser[] }
      setMembers(d.members)
    } catch {
      setError('Couldn’t load this client’s portal members.')
    } finally {
      setLoading(false)
    }
  }, [authHeaders, id])

  useEffect(() => {
    // Loading a list IS synchronising with an external system; the rule fires
    // only because the fetch starts synchronously rather than from a callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const change = async (
    portalUserId: string,
    patch: { role?: PortalRole; can_sign?: boolean; can_pay?: boolean },
  ) => {
    const h = await authHeaders()
    if (!h) return
    setError('')
    try {
      const res = await fetch('/api/v1/crm/portal-members', {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ contact_id: id, portal_user_id: portalUserId, ...patch }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(d?.error?.message ?? 'That change couldn’t be saved.')
      }
      const d = await res.json() as { member: PortalUser }
      setMembers((prev) => prev.map((m) => (m.id === d.member.id ? d.member : m)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change couldn’t be saved.')
    }
  }

  const setAccess = async (portalUserId: string, revoked: boolean) => {
    const h = await authHeaders()
    if (!h) return
    setError('')
    try {
      const res = await fetch('/api/v1/crm/portal-members', {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ contact_id: id, portal_user_id: portalUserId, revoked }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(d?.error?.message ?? 'That change couldn’t be saved.')
      }
      const d = await res.json() as { member: PortalUser }
      setMembers((prev) => prev.map((m) => (m.id === d.member.id ? d.member : m)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change couldn’t be saved.')
    }
  }

  const remove = async (portalUserId: string) => {
    const h = await authHeaders()
    if (!h) return
    setError('')
    try {
      const res = await fetch(
        `/api/v1/crm/portal-members?contact_id=${encodeURIComponent(id)}&id=${encodeURIComponent(portalUserId)}`,
        { method: 'DELETE', headers: h },
      )
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(d?.error?.message ?? 'They couldn’t be removed.')
      }
      setMembers((prev) => prev.filter((m) => m.id !== portalUserId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'They couldn’t be removed.')
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <div className="mb-6">
        <h1 className="font-display text-xl font-normal text-gray-800">Portal members</h1>
        <p className="text-xs text-gray-400 mt-1">
          Everyone on the client’s side with portal access, and what each of them can do.
        </p>
      </div>

      <div className="max-w-2xl">
        <PortalMemberList
          members={members}
          canManage
          accent={accent}
          loading={loading}
          error={error}
          onChange={change}
          onSetAccess={setAccess}
          onRemove={remove}
        />
      </div>
    </div>
  )
}
