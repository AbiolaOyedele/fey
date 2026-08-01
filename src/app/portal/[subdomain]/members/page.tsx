'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { FadeIn } from '@/components/ui/motion'
import PortalMemberList from '@/components/crm/PortalMemberList'
import { canManagePortalMembers, type PortalRole, type PortalUser } from '@/types/crm'

/**
 * The client's own team page — who from their side has access, and what each
 * of them can do. Only their portal admin can change anything; everyone else
 * sees the same list read-only, which is useful on its own ("who signed that?").
 */
export default function PortalMembersPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const accent = usePortalAccent(subdomain)

  const [members, setMembers] = useState<PortalUser[]>([])
  const [meId, setMeId]       = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const headers = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [subdomain])

  const load = useCallback(async () => {
    const h = headers()
    if (!h) { setLoading(false); return }
    try {
      const res = await fetch('/api/v1/portal/members', { headers: h })
      if (!res.ok) throw new Error('load failed')
      const d = await res.json() as { members: PortalUser[]; me: string }
      setMembers(d.members)
      setMeId(d.me)
    } catch {
      setError('Couldn’t load your team. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    // Loading a list IS synchronising with an external system; the rule fires
    // only because the fetch starts synchronously rather than from a callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const me = members.find((m) => m.id === meId)
  const canManage = !!me && canManagePortalMembers(me.role)

  const change = async (
    portalUserId: string,
    patch: { role?: PortalRole; can_sign?: boolean; can_pay?: boolean },
  ) => {
    const h = headers()
    if (!h) return
    setError('')
    try {
      const res = await fetch('/api/v1/portal/members', {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ portal_user_id: portalUserId, ...patch }),
      })
      if (!res.ok) {
        // The API already returns plain-English messages — surface that rather
        // than a generic one, so "you're the last admin" actually reaches them.
        const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(d?.error?.message ?? 'That change couldn’t be saved.')
      }
      const d = await res.json() as { member: PortalUser }
      setMembers((prev) => prev.map((m) => (m.id === d.member.id ? d.member : m)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change couldn’t be saved.')
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Users size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Your team</h1>
        </div>
        <p className="text-xs text-gray-400 mb-6">
          {canManage
            ? 'Everyone from your side with access to this portal. Set what each person can do.'
            : 'Everyone from your side with access to this portal.'}
        </p>
      </FadeIn>

      <div className="max-w-2xl">
        <PortalMemberList
          members={members}
          meId={meId}
          canManage={canManage}
          accent={accent}
          loading={loading}
          error={error}
          onChange={change}
        />
      </div>
    </div>
  )
}
