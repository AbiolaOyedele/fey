'use client'

import { useState } from 'react'
import { X, Copy, Check, Link2, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CrmContact, ContactStatus, CreateContactPayload } from '@/types/crm'

interface AddContactModalProps {
  onClose:  () => void
  onCreate: (payload: CreateContactPayload) => Promise<CrmContact>
}

type Step = 'form' | 'success'

export default function AddContactModal({ onClose, onCreate }: AddContactModalProps) {
  // ── Form fields ────────────────────────────────────────────────────────────
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  const [company, setCompany] = useState('')
  const [status,  setStatus]  = useState<ContactStatus>('active')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // ── Success step ───────────────────────────────────────────────────────────
  const [step,         setStep]         = useState<Step>('form')
  const [inviteUrl,    setInviteUrl]    = useState<string | null>(null)
  const [inviteCode,   setInviteCode]   = useState<string | null>(null)
  const [copiedUrl,    setCopiedUrl]    = useState(false)
  const [copiedCode,   setCopiedCode]   = useState(false)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [createdName,  setCreatedName]  = useState('')

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError(null)

    try {
      const contact = await onCreate({
        name:    name.trim(),
        email:   email.trim() || null,
        phone:   phone.trim() || null,
        company: company.trim() || null,
        status,
      })

      setCreatedName(contact.name)
      setStep('success')

      // Fetch invite link in background
      void fetchInvite(contact.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client.')
    } finally {
      setSaving(false)
    }
  }

  const fetchInvite = async (contactId: string) => {
    setLoadingInvite(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const res = await fetch(`/api/v1/crm/contacts/${contactId}/invite`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json() as { invite_code: string; invite_url: string }
        setInviteCode(data.invite_code)
        setInviteUrl(data.invite_url)
      }
    } finally {
      setLoadingInvite(false)
    }
  }

  const copyUrl = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const copyCode = async () => {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <div className="bg-white rounded-2xl w-full max-w-md flex flex-col overflow-hidden animate-scaleIn shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Client created</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-5">
            {/* Confirmation */}
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Check size={16} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{createdName} added</p>
                <p className="text-[12px] text-gray-400">Share the invite link so they can join your portal.</p>
              </div>
            </div>

            {/* Invite link */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Link2 size={11} />
                Invite link
              </p>

              {loadingInvite ? (
                <div className="flex items-center gap-2 text-[13px] text-gray-400 py-2">
                  <Loader2 size={13} className="animate-spin" />
                  Generating invite link…
                </div>
              ) : inviteUrl ? (
                <div className="space-y-2">
                  {/* Full URL */}
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11.5px] bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-gray-600 truncate">
                      {inviteUrl}
                    </code>
                    <button
                      onClick={() => void copyUrl()}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      {copiedUrl ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      {copiedUrl ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>

                  {/* Short code */}
                  {inviteCode && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-[12px] text-gray-400">Access code:</span>
                        <code className="text-[13px] font-mono font-bold text-gray-800 tracking-widest bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">
                          {inviteCode}
                        </code>
                      </div>
                      <button
                        onClick={() => void copyCode()}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        {copiedCode ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        {copiedCode ? 'Copied!' : 'Copy code'}
                      </button>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-400">
                    Send this link to {createdName}. The access code is pre-filled when they open the link.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-gray-400 py-1">
                  Could not generate invite link. You can find it later in the client&apos;s portal settings.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 pt-3 border-t border-gray-100">
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              Done
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form screen ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md flex flex-col overflow-hidden animate-scaleIn shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Client</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Name *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@acme.com"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContactStatus)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 transition-colors"
            >
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={(e) => void handleSubmit(e)}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            {saving ? 'Creating…' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  )
}
