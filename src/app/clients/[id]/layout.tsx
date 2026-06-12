'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MoreHorizontal, Edit2, Trash2, Copy, Check, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ContactTabs from '@/components/crm/ContactTabs'
import ClientSearchDialog from '@/components/crm/ClientSearchDialog'
import { relativeTime, isActiveWithin } from '@/utils/relativeTime'

interface ContactDetailLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

interface ContactSummary {
  id:      string
  name:    string
  company: string | null
}

export default function ContactDetailLayout({ children, params }: ContactDetailLayoutProps) {
  const { id } = use(params)
  const router  = useRouter()

  // ── Fetch only this contact's name — no full-list round-trip ─────────────
  const [contact, setContact] = useState<ContactSummary | null>(null)

  const [lastSeen, setLastSeen] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('crm_contacts')
        .select('id, name, company')
        .eq('id', id)
        .single()
      if (data) setContact(data as ContactSummary)

      // Last portal activity (best-effort)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/v1/crm/activity', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const { activity } = await res.json() as { activity: Record<string, string> }
        setLastSeen(activity[id] ?? null)
      }
    })()
  }, [id])

  const [menuOpen,    setMenuOpen]    = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [searchOpen,  setSearchOpen]  = useState(false)

  // ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  const closeSearch = useCallback(() => setSearchOpen(false), [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-contact-menu]')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCopyInviteLink = async () => {
    // Single source of truth for the invite URL: the invite API returns the
    // short access code AND the correct path-based join URL. Building the URL
    // by hand here is what produced the broken /portal/signup?code=<uuid> link.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetch(`/api/v1/crm/contacts/${id}/invite`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json() as { invite_url: string }
      await navigator.clipboard.writeText(data.invite_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } finally {
      setMenuOpen(false)
    }
  }

  const handleDelete = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    await fetch(`/api/v1/crm/contacts/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    router.push('/clients')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/clients')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={15} />
            Clients
          </button>

          {contact && (
            <>
              <span className="text-gray-300 flex-shrink-0">/</span>
              <span className="text-sm font-medium text-gray-900 truncate">{contact.name}</span>
              {contact.company && (
                <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">· {contact.company}</span>
              )}
              {lastSeen && (
                <span className="text-xs text-gray-400 flex-shrink-0 hidden md:inline">
                  · {isActiveWithin(lastSeen) ? 'Active' : 'Last seen'} {relativeTime(lastSeen)}
                </span>
              )}
            </>
          )}

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              title="Search this contact (⌘K)"
            >
              <Search size={14} />
              <span className="hidden sm:inline text-xs">Search</span>
              <kbd className="hidden md:inline text-[10px] text-gray-300 border border-gray-200 px-1 rounded font-mono">⌘K</kbd>
            </button>

            {/* Three-dot menu */}
            <div className="relative" data-contact-menu>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <MoreHorizontal size={18} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-100 z-50 py-1 animate-fadeIn shadow-lg">
                  <button
                    onClick={() => { router.push(`/clients/${id}/portal-settings`); setMenuOpen(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Edit2 size={14} className="text-gray-400" />
                    Edit client
                  </button>
                  <button
                    onClick={() => void handleCopyInviteLink()}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
                    {copied ? 'Copied!' : 'Copy invite link'}
                  </button>
                  <div className="my-1 border-t border-gray-100 mx-3" />
                  {confirmDel ? (
                    <button
                      onClick={() => void handleDelete()}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 font-semibold hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 size={14} />
                      Confirm delete
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDel(true)}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete client
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ContactTabs contactId={id} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-appbg">
        {children}
      </div>

      {/* Search dialog — portal-level overlay */}
      {searchOpen && contact && (
        <ClientSearchDialog
          contactId={id}
          contactName={contact.name}
          onClose={closeSearch}
        />
      )}
    </div>
  )
}
