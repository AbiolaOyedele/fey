'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { Users, Plus, X, Loader2 } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { FadeIn } from '@/components/ui/motion'
import PortalMemberList from '@/components/crm/PortalMemberList'
import {
  PORTAL_ROLES,
  PORTAL_ROLE_LABEL,
  canManagePortalMembers,
  type PortalRole,
  type PortalUser,
} from '@/types/crm'

/**
 * The client's own team page — who from their side has access, what each of them
 * can do, and (for their admin) adding colleagues. Only their portal admin can
 * change anything; everyone else sees the same list read-only, which is useful
 * on its own ("who signed that?").
 */
export default function PortalMembersPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const accent = usePortalAccent(subdomain)

  const [members, setMembers] = useState<PortalUser[]>([])
  const [meId, setMeId]       = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Add member
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [role, setRole]       = useState<PortalRole>('collaborator')
  const [adding, setAdding]   = useState(false)

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

  const removeMember = async (portalUserId: string) => {
    const h = headers()
    if (!h) return
    setError('')
    try {
      const res = await fetch(`/api/v1/portal/members?id=${encodeURIComponent(portalUserId)}`, {
        method: 'DELETE',
        headers: h,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(d?.error?.message ?? 'They couldn’t be removed.')
      }
      setMembers((prev) => prev.filter((m) => m.id !== portalUserId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'They couldn’t be removed.')
    }
  }

  const add = async () => {
    const h = headers()
    if (!h || !name.trim() || !email.trim()) return
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/v1/portal/members', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(d?.error?.message ?? 'They couldn’t be added.')
      }
      const d = await res.json() as { member: PortalUser }
      setMembers((prev) => [...prev, d.member])
      setName(''); setEmail(''); setRole('collaborator'); setShowAdd(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'They couldn’t be added.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: accent }} />
            <h1 className="font-display text-xl font-normal text-gray-800">Your team</h1>
          </div>
          {canManage && !showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="press inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-white text-sm font-semibold hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <Plus size={15} /> Add someone
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-5">
          {canManage
            ? 'Everyone from your side with access. Set what each person can do.'
            : 'Everyone from your side with access to this portal.'}
        </p>
      </FadeIn>

      <div className="max-w-xl space-y-3">
        {showAdd && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xs font-semibold uppercase tracking-widest text-gray-300">Add someone</span>
              <button
                onClick={() => setShowAdd(false)}
                aria-label="Cancel"
                className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-300 hover:text-gray-500"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Their name"
                aria-label="Their name"
                autoFocus
                className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                placeholder="Their email"
                aria-label="Their email"
                className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
              />
              <div className="flex bg-gray-100 rounded-xl p-0.5">
                {PORTAL_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2.5 min-h-[40px] rounded-lg text-2xs font-medium transition-colors ${
                      role === r ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
                    }`}
                  >
                    {PORTAL_ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-2.5 min-h-[44px] rounded-full text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void add()}
                disabled={!name.trim() || !email.trim() || adding}
                className="press inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-white text-xs font-semibold disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                {adding && <Loader2 size={12} className="animate-spin" />}
                Add
              </button>
            </div>

            <p className="text-2xs text-gray-400 leading-relaxed mt-3 pt-3 border-t border-gray-50">
              They’ll show as pending until they join with your portal’s invite link and set a password.
            </p>
          </div>
        )}

        <PortalMemberList
          members={members}
          meId={meId}
          canManage={canManage}
          accent={accent}
          loading={loading}
          error={error}
          onChange={change}
          onRemove={removeMember}
        />
      </div>
    </div>
  )
}
