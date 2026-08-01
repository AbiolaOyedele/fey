'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { Settings, Bell, User, Check } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { FadeIn } from '@/components/ui/motion'

/**
 * The client's own settings. Deliberately small: a client should be able to
 * control what reaches them and see who they're signed in as — nothing else in
 * the portal is theirs to configure.
 */

interface Prefs {
  messages: boolean
  files: boolean
  contracts: boolean
  forms: boolean
  invoices: boolean
  tasks: boolean
}

const ROWS: Array<{ key: keyof Prefs; label: string; description: string }> = [
  { key: 'messages',  label: 'Messages',  description: 'When the team sends you a message.' },
  { key: 'files',     label: 'Files',     description: 'When a new file is shared with you.' },
  { key: 'contracts', label: 'Contracts', description: 'When a contract needs your signature.' },
  { key: 'forms',     label: 'Forms',     description: 'When a form is waiting to be filled in.' },
  { key: 'invoices',  label: 'Invoices',  description: 'New invoices and payment requests.' },
  { key: 'tasks',     label: 'Tasks',     description: 'Updates on tasks that involve you.' },
]

export default function PortalSettingsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const accent = usePortalAccent(subdomain)

  const [prefs, setPrefs]     = useState<Prefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null)

  const headers = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [subdomain])

  useEffect(() => {
    void (async () => {
      const h = headers()
      if (!h) { setLoading(false); return }
      const [prefsRes, sessionRes] = await Promise.all([
        fetch('/api/v1/portal/notifications/prefs', { headers: h }),
        fetch('/api/v1/portal/auth/session', { headers: h }),
      ])
      if (prefsRes.ok) {
        const d = await prefsRes.json() as { prefs: Prefs }
        setPrefs(d.prefs)
      }
      if (sessionRes.ok) {
        const d = await sessionRes.json() as { name: string; email: string }
        setProfile({ name: d.name, email: d.email })
      }
      setLoading(false)
    })()
  }, [headers])

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
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch {
      setPrefs(prefs)
      setError('That change couldn’t be saved. Please try again.')
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Settings size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Settings</h1>
        </div>
        <p className="text-xs text-gray-400 mb-6">Control what you hear about and check your details.</p>
      </FadeIn>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <section>
          <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Your details</span>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
            {loading ? (
              <div className="h-10 rounded-lg bg-gray-50 animate-pulse" />
            ) : profile ? (
              <div className="flex items-center gap-3">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                  style={{ backgroundColor: accent }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{profile.name}</p>
                  <p className="text-xs text-gray-400 truncate">{profile.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sign in again to see your details.</p>
            )}
            <p className="text-2xs text-gray-400 leading-relaxed mt-3 pt-3 border-t border-gray-50">
              Need your name or email changed? Message the team and they’ll update it for you.
            </p>
          </div>
        </section>

        {/* Notification preferences */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300">Notifications</span>
            {saved && (
              <span className="inline-flex items-center gap-1 text-2xs font-medium" style={{ color: accent }}>
                <Check size={12} /> Saved
              </span>
            )}
          </div>

          {error && (
            <div className="mb-2 rounded-xl p-3 text-xs" style={{ backgroundColor: '#FDECEC', color: '#E53E3E' }}>
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            {loading || !prefs ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-gray-50 animate-pulse" />
                ))}
              </div>
            ) : (
              ROWS.map(({ key, label, description }, i) => (
                <button
                  key={key}
                  type="button"
                  role="switch"
                  aria-checked={prefs[key]}
                  onClick={() => void toggle(key)}
                  className={`w-full flex items-start gap-3 p-4 text-left min-h-[44px] hover:bg-gray-50/60 transition-colors ${i > 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex-shrink-0 inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-colors"
                    style={{ backgroundColor: prefs[key] ? accent : '#E2E8F0' }}
                  >
                    <span
                      className="w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                      style={{ transform: prefs[key] ? 'translateX(16px)' : 'translateX(0)' }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-gray-700">{label}</span>
                    <span className="block text-2xs text-gray-400 leading-relaxed mt-0.5">{description}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          <p className="flex items-start gap-1.5 text-2xs text-gray-400 leading-relaxed mt-2">
            <Bell size={11} className="flex-shrink-0 mt-0.5" />
            Turning one off stops new notifications in that category. Anything already sent stays in your list.
          </p>
        </section>

        <p className="flex items-start gap-1.5 text-2xs text-gray-300 leading-relaxed">
          <User size={11} className="flex-shrink-0 mt-0.5" />
          These settings are yours alone — they don’t affect anyone else with access to this portal.
        </p>
      </div>
    </div>
  )
}
