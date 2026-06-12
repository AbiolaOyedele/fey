'use client'

import { use, useState, useCallback, useEffect } from 'react'
import { Globe, Link2, Copy, Check, RefreshCw, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
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
  const [copiedLink,    setCopiedLink]    = useState(false)
  const [inviteCode,    setInviteCode]    = useState<string | null>(null)
  const [inviteUrl,     setInviteUrl]     = useState<string | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [regenLoading,  setRegenLoading]  = useState(false)

  // ── Load invite code ────────────────────────────────────────────────────────

  const loadInvite = useCallback(async (regenerate = false) => {
    if (!user?.id) return
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return

    if (regenerate) setRegenLoading(true)
    else setLoadingInvite(true)

    try {
      const res = await fetch(
        `/api/v1/crm/contacts/${id}/invite`,
        {
          method:  regenerate ? 'POST' : 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (res.ok) {
        const data = await res.json() as { invite_code: string; invite_url: string }
        setInviteCode(data.invite_code)
        setInviteUrl(data.invite_url)
      }
    } finally {
      setLoadingInvite(false)
      setRegenLoading(false)
    }
  }, [id, user?.id])

  useEffect(() => {
    void loadInvite()
  }, [loadInvite])

  // ── Portal URL (workspace slug-based) ────────────────────────────────────────

  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    void supabase
      .from('fey_settings')
      .select('workspace_slug')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setWorkspaceSlug((data as { workspace_slug: string | null } | null)?.workspace_slug ?? null)
      })
  }, [user?.id])

  // Path-based portal URL — subdomain routing isn't wired, so the working form
  // is <origin>/portal/<slug>. The invite API already returns the correct
  // absolute invite_url; this fallback only fires if that request hasn't landed.
  const origin     = typeof window !== 'undefined' ? window.location.origin : ''
  const portalBase = workspaceSlug ? `${origin}/portal/${workspaceSlug}` : null

  const displayInviteUrl = inviteUrl ?? (portalBase && inviteCode ? `${portalBase}/join?code=${inviteCode}` : null)

  // ── Clipboard helpers ────────────────────────────────────────────────────────

  const copyCode = async () => {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLink = async () => {
    if (!displayInviteUrl) return
    await navigator.clipboard.writeText(displayInviteUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // ── Toggle / welcome ─────────────────────────────────────────────────────────

  const togglePortal = async () => {
    if (!contact) return
    const next = !portalEnabled
    setPortalEnabled(next)
    await updateContact(id, { portal_enabled: next })
    // Load / refresh invite code when enabling
    if (next) void loadInvite()
  }

  const saveWelcome = async () => {
    if (!contact) return
    setSaving(true)
    await updateContact(id, { portal_welcome_message: welcomeMsg || null })
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Portal Settings</h2>
        <p className="text-sm text-gray-400">Manage this client&apos;s access to their portal.</p>
      </div>

      {/* Enable / Disable */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
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

      {/* Invite link */}
      {!workspaceSlug && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
          <p className="text-sm text-amber-700 font-medium">No workspace URL configured</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Complete your <a href="/setup" className="underline">workspace setup</a> to generate invite links.
          </p>
        </div>
      )}

      {workspaceSlug && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Link2 size={14} className="text-gray-400" />
              Invite link
            </p>
            <button
              onClick={() => void loadInvite(true)}
              disabled={regenLoading}
              title="Regenerate code"
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RefreshCw size={12} className={regenLoading ? 'animate-spin' : ''} />
              {regenLoading ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>

          {loadingInvite ? (
            <div className="flex items-center gap-2 text-[13px] text-gray-400">
              <Loader2 size={13} className="animate-spin" />
              Generating code…
            </div>
          ) : displayInviteUrl ? (
            <>
              {/* Invite URL */}
              <div className="flex items-center gap-2 mb-3">
                <code className="flex-1 text-[12px] bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-gray-600 truncate">
                  {displayInviteUrl}
                </code>
                <button
                  onClick={() => void copyLink()}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  {copiedLink ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedLink ? 'Copied!' : 'Copy link'}
                </button>
              </div>

              {/* Short code */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[12px] text-gray-400">Access code:</span>
                  <code className="text-[13px] font-mono font-semibold text-gray-800 tracking-widest bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">
                    {inviteCode}
                  </code>
                </div>
                <button
                  onClick={() => void copyCode()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  {copied ? 'Copied!' : 'Copy code'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-gray-400">No invite code yet. Enable portal access to generate one.</p>
          )}

          <p className="text-[12px] text-gray-400 mt-3">
            Share this link with your client so they can join your workspace.
            The access code is pre-filled automatically.
          </p>
        </div>
      )}

      {/* Portal URL */}
      {portalBase && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Globe size={14} className="text-gray-400" />
            Portal URL
          </p>
          <code className="block text-[12px] bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-gray-500">
            {portalBase}
          </code>
        </div>
      )}

      {/* Welcome message */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-800 mb-1">Welcome message</label>
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
