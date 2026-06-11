'use client'

import { use, useState, useCallback } from 'react'
import { Globe, Copy, Check, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { useContacts } from '@/hooks/useCrm'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export default function PortalSettingsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const { contacts, updateContact } = useContacts()
  const contact = contacts.find((c) => c.id === id)

  const [portalEnabled, setPortalEnabled] = useState(contact?.portal_enabled ?? false)
  const [welcomeMsg,    setWelcomeMsg]    = useState(contact?.portal_welcome_message ?? '')
  const [saving,        setSaving]        = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [subdomain,     setSubdomain]     = useState<string | null>(null)

  // Load portal subdomain from fey_settings once
  const loadSubdomain = useCallback(async () => {
    if (!user?.id || subdomain !== null) return
    const { data } = await supabase
      .from('fey_settings')
      .select('portal_subdomain')
      .eq('user_id', user.id)
      .maybeSingle()
    setSubdomain((data as { portal_subdomain: string | null } | null)?.portal_subdomain ?? '')
  }, [user?.id, subdomain])

  // Kick off load on first render
  if (subdomain === null && user?.id) {
    void loadSubdomain()
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourdomain.com'
  const portalUrl  = subdomain ? `https://${subdomain}.${rootDomain}` : null

  const copyLink = async () => {
    if (!portalUrl) return
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const togglePortal = async () => {
    if (!contact) return
    const next = !portalEnabled
    setPortalEnabled(next)
    await updateContact(id, { portal_enabled: next })
  }

  const saveWelcome = async () => {
    if (!contact) return
    setSaving(true)
    await updateContact(id, { portal_welcome_message: welcomeMsg || null })
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Portal Settings</h2>
        <p className="text-sm text-gray-400">Manage this client's access to their portal.</p>
      </div>

      {/* Enable / Disable */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Portal access</p>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {portalEnabled
                ? 'This client can log in and view their portal.'
                : 'Enable to let this client access their client portal.'}
            </p>
          </div>
          <button
            onClick={() => void togglePortal()}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
          >
            {portalEnabled
              ? <ToggleRight size={28} style={{ color: 'var(--accent, #ED64A6)' }} />
              : <ToggleLeft  size={28} />
            }
          </button>
        </div>
      </div>

      {/* Portal link */}
      {portalUrl && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Globe size={15} className="text-gray-400" />
            Portal link
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-600 truncate">
              {portalUrl}
            </code>
            <button
              onClick={() => void copyLink()}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {!subdomain && subdomain !== null && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-4">
          <p className="text-sm text-amber-700 font-medium">No portal subdomain configured</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Go to <a href="/settings" className="underline">Settings → Portal</a> to set your subdomain before sharing the portal link.
          </p>
        </div>
      )}

      {/* Welcome message */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-800 mb-2">Welcome message</label>
        <p className="text-[13px] text-gray-400 mb-3">Shown on the portal home page for this client.</p>
        <textarea
          rows={3}
          value={welcomeMsg}
          onChange={(e) => setWelcomeMsg(e.target.value)}
          placeholder="Welcome! Here you can track your project, send messages, and sign contracts."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors resize-none"
        />
        <button
          onClick={() => void saveWelcome()}
          disabled={saving}
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
