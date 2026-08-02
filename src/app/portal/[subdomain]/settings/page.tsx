'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { Settings, Check, Pencil, Loader2 } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { usePortalSession } from '@/contexts/PortalSessionContext'
import { FadeIn } from '@/components/ui/motion'
import type { PortalUser } from '@/types/crm'

/**
 * The client's own settings. Deliberately small: their name, and what reaches
 * them. Everything else in the portal belongs to the agency.
 */

interface Prefs {
  messages: boolean
  files: boolean
  contracts: boolean
  forms: boolean
  invoices: boolean
  tasks: boolean
}

const ROWS: Array<{ key: keyof Prefs; label: string }> = [
  { key: 'messages',  label: 'Messages' },
  { key: 'files',     label: 'New files' },
  { key: 'contracts', label: 'Contracts to sign' },
  { key: 'forms',     label: 'Forms to fill in' },
  { key: 'invoices',  label: 'Invoices & payments' },
  { key: 'tasks',     label: 'Task updates' },
]

export default function PortalSettingsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const accent  = usePortalAccent(subdomain)
  const session = usePortalSession()
  const me      = session?.session.portalUser ?? null

  const [prefs, setPrefs]     = useState<Prefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  // Name editing
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft]     = useState('')
  const [savingName, setSavingName]   = useState(false)

  const headers = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [subdomain])

  useEffect(() => {
    void (async () => {
      const h = headers()
      if (!h) { setLoading(false); return }
      // Only prefs are fetched — identity already came from the layout's session.
      const res = await fetch('/api/v1/portal/notifications/prefs', { headers: h })
      if (res.ok) {
        const d = await res.json() as { prefs: Prefs }
        setPrefs(d.prefs)
      }
      setLoading(false)
    })()
  }, [headers])

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800) }

  const toggle = async (key: keyof Prefs) => {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    // Optimistic: the switch moves immediately and rolls back if the save fails.
    setPrefs(next)
    setError('')
    const h = headers()
    if (!h) return
    try {
      const res = await fetch('/api/v1/portal/notifications/prefs', {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ [key]: next[key] }),
      })
      if (!res.ok) throw new Error('save failed')
      flash()
    } catch {
      setPrefs(prefs)
      setError('That change couldn’t be saved. Please try again.')
    }
  }

  const startEdit = () => {
    setNameDraft(me?.name ?? '')
    setEditingName(true)
    setError('')
  }

  const saveName = async () => {
    const name = nameDraft.trim()
    if (!name || !session) return
    if (name === me?.name) { setEditingName(false); return }
    const h = headers()
    if (!h) return
    setSavingName(true)
    setError('')
    try {
      const res = await fetch('/api/v1/portal/profile', { method: 'PATCH', headers: h, body: JSON.stringify({ name }) })
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(d?.error?.message ?? 'That name couldn’t be saved.')
      }
      const d = await res.json() as { user: PortalUser }
      // Update the shared session so the sidebar and greeting change too.
      session.setPortalUser(d.user)
      setEditingName(false)
      flash()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That name couldn’t be saved.')
    } finally {
      setSavingName(false)
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Settings size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Settings</h1>
        </div>
        <p className="text-xs text-gray-400 mb-5">Your details, and what you hear about.</p>
      </FadeIn>

      <div className="max-w-xl space-y-5">
        {error && (
          <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#FDECEC', color: '#E53E3E' }}>
            {error}
          </div>
        )}

        {/* Your details */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-2xs font-semibold uppercase tracking-widest text-gray-300">Your details</span>
            {saved && (
              <span className="inline-flex items-center gap-1 text-2xs font-medium" style={{ color: accent }}>
                <Check size={12} /> Saved
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            {!me ? (
              <div className="h-10 rounded-lg bg-gray-50 animate-pulse" />
            ) : editingName ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void saveName(); if (e.key === 'Escape') setEditingName(false) }}
                  autoFocus
                  aria-label="Your name"
                  className="flex-1 px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingName(false)}
                    className="px-3 py-2.5 min-h-[44px] rounded-full text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void saveName()}
                    disabled={!nameDraft.trim() || savingName}
                    className="press inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-white text-xs font-semibold disabled:opacity-40"
                    style={{ backgroundColor: accent }}
                  >
                    {savingName && <Loader2 size={12} className="animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                  style={{ backgroundColor: accent }}
                >
                  {me.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{me.name}</p>
                  <p className="text-2xs text-gray-400 truncate">{me.email}</p>
                </div>
                <button
                  onClick={startEdit}
                  className="w-11 h-11 -mr-2 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors"
                  aria-label="Change your name"
                  title="Change your name"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )}
            <p className="text-2xs text-gray-300 leading-relaxed mt-3 pt-3 border-t border-gray-50">
              Your email is how you sign in — message the team if it needs changing.
            </p>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Notify me about</span>

          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            {loading || !prefs ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-lg bg-gray-50 animate-pulse" />
                ))}
              </div>
            ) : (
              ROWS.map(({ key, label }, i) => (
                <button
                  key={key}
                  type="button"
                  role="switch"
                  aria-checked={prefs[key]}
                  onClick={() => void toggle(key)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] text-left hover:bg-gray-50/60 transition-colors ${
                    i > 0 ? 'border-t border-gray-50' : ''
                  }`}
                >
                  <span className="text-xs font-medium text-gray-700">{label}</span>
                  <span
                    aria-hidden
                    className="flex-shrink-0 inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-colors"
                    style={{ backgroundColor: prefs[key] ? accent : '#E2E8F0' }}
                  >
                    <span
                      className="w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                      style={{ transform: prefs[key] ? 'translateX(16px)' : 'translateX(0)' }}
                    />
                  </span>
                </button>
              ))
            )}
          </div>

          <p className="text-2xs text-gray-300 leading-relaxed mt-2">
            Turning one off stops new notifications in that category. Anything already sent stays in your list.
          </p>
        </section>
      </div>
    </div>
  )
}
