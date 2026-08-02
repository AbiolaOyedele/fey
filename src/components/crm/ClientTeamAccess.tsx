'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * Which of your team this client can see — and assign tasks to — from their
 * portal.
 *
 * Opt-in on purpose: with nobody ticked the client sees no names at all, so
 * turning a portal on never exposes the roster by accident. Ticking someone is
 * what makes them appear in the client's assignee picker.
 */

interface Member {
  user_id: string
  name: string | null
  email: string | null
}

interface ClientTeamAccessProps {
  contactId: string
}

export default function ClientTeamAccess({ contactId }: ClientTeamAccessProps) {
  const [members, setMembers]   = useState<Member[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  const authHeaders = useCallback(async (): Promise<HeadersInit | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [])

  useEffect(() => {
    void (async () => {
      const h = await authHeaders()
      if (!h) { setLoading(false); return }
      try {
        const res = await fetch(`/api/v1/crm/client-team-access?contact_id=${contactId}`, { headers: h })
        if (!res.ok) throw new Error('load failed')
        const d = await res.json() as { members: Member[]; selected: string[] }
        setMembers(d.members)
        setSelected(d.selected)
      } catch {
        setError('Couldn’t load your team. Please refresh and try again.')
      } finally {
        setLoading(false)
      }
    })()
  }, [contactId, authHeaders])

  const save = async (next: string[]) => {
    const previous = selected
    // Optimistic — the tick moves now and rolls back if the save fails.
    setSelected(next)
    setSaving(true)
    setError('')
    try {
      const h = await authHeaders()
      if (!h) throw new Error('no session')
      const res = await fetch('/api/v1/crm/client-team-access', {
        method: 'PUT',
        headers: h,
        body: JSON.stringify({ contact_id: contactId, user_ids: next }),
      })
      if (!res.ok) throw new Error('save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch {
      setSelected(previous)
      setError('That change couldn’t be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (userId: string) => {
    const next = selected.includes(userId)
      ? selected.filter((id) => id !== userId)
      : [...selected, userId]
    void save(next)
  }

  const label = (m: Member) => m.name ?? m.email ?? 'Team member'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Users size={14} className="text-gray-400" />
          Who this client can see
        </p>
        {saving ? (
          <Loader2 size={13} className="animate-spin text-gray-300" />
        ) : saved ? (
          <span className="inline-flex items-center gap-1 text-2xs font-medium" style={{ color: 'var(--accent, #ED64A6)' }}>
            <Check size={12} /> Saved
          </span>
        ) : null}
      </div>
      <p className="text-xs2 text-gray-400 mb-4">
        Only the people you tick appear in this client&apos;s portal, and only they can be assigned tasks by the client.
      </p>

      {error && (
        <div className="mb-3 rounded-xl p-3 text-xs" style={{ backgroundColor: '#FDECEC', color: '#E53E3E' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-gray-50 animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="text-xs2 text-gray-400 leading-relaxed">
          You haven&apos;t added anyone to your workspace yet. Invite your team first, then choose who this client can reach.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const on = selected.includes(m.user_id)
              return (
                <button
                  key={m.user_id}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => toggle(m.user_id)}
                  className="inline-flex items-center gap-2 pl-1 pr-3 min-h-[44px] rounded-full border text-xs font-medium transition-colors"
                  style={on
                    ? { borderColor: 'var(--accent, #ED64A6)', backgroundColor: 'rgba(237,100,166,0.08)', color: '#374151' }
                    : { borderColor: '#E5E7EB', color: '#6B7280' }}
                >
                  <span
                    aria-hidden
                    className="w-7 h-7 rounded-full flex items-center justify-center text-2xs font-semibold text-white"
                    style={{ backgroundColor: on ? 'var(--accent, #ED64A6)' : '#CBD5E1' }}
                  >
                    {on ? <Check size={12} /> : label(m).charAt(0).toUpperCase()}
                  </span>
                  {label(m)}
                </button>
              )
            })}
          </div>

          {selected.length === 0 && (
            <p className="text-2xs text-gray-400 leading-relaxed mt-3">
              Nobody selected — this client sees no team names, and any task they raise comes through unassigned.
            </p>
          )}
        </>
      )}
    </div>
  )
}
