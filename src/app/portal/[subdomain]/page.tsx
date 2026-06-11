'use client'
import { portalTokenKey } from '@/hooks/usePortalAuth'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare, FileSignature, ClipboardList, ArrowRight } from 'lucide-react'

interface OverviewCard {
  label: string
  count: number
  icon: React.ReactNode
  href: string
  accent: string
}

function StatCard({ card, subdomain }: { card: OverviewCard; subdomain: string }) {
  return (
    <Link
      href={`/portal/${subdomain}${card.href}`}
      className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.accent}18` }}>
          <span style={{ color: card.accent }}>{card.icon}</span>
        </div>
        <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{card.count}</p>
      <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
    </Link>
  )
}

export default function PortalHome({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)

  const [unreadMessages, setUnreadMessages]     = useState(0)
  const [pendingContracts, setPendingContracts] = useState(0)
  const [pendingForms, setPendingForms]         = useState(0)
  const [loading, setLoading]                   = useState(true)
  const [clientName, setClientName]             = useState('')

  useEffect(() => {
    void (async () => {
      const token = localStorage.getItem(portalTokenKey(subdomain))
      if (!token) { setLoading(false); return }

      const [msgsRes, contractsRes, formsRes, sessionRes] = await Promise.all([
        fetch('/api/v1/portal/messages',  { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/portal/contracts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/portal/forms',     { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/portal/auth/session', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (msgsRes.ok) {
        const d = await msgsRes.json() as { messages: Array<{ read_at: string | null }> }
        setUnreadMessages(d.messages.filter((m) => !m.read_at).length)
      }
      if (contractsRes.ok) {
        const d = await contractsRes.json() as { contracts: Array<{ status: string }> }
        setPendingContracts(d.contracts.filter((c) => c.status === 'sent').length)
      }
      if (formsRes.ok) {
        const d = await formsRes.json() as { forms: Array<{ status: string }> }
        setPendingForms(d.forms.filter((f) => f.status === 'sent').length)
      }
      if (sessionRes.ok) {
        const d = await sessionRes.json() as { name: string }
        setClientName(d.name)
      }

      setLoading(false)
    })()
  }, [subdomain])

  const cards: OverviewCard[] = [
    { label: 'Unread messages',   count: unreadMessages,   icon: <MessageSquare size={18} />, href: '/messages',  accent: '#6366F1' },
    { label: 'Pending contracts', count: pendingContracts, icon: <FileSignature size={18} />, href: '/contracts', accent: '#F59E0B' },
    { label: 'Pending forms',     count: pendingForms,     icon: <ClipboardList size={18} />, href: '/forms',     accent: '#10B981' },
  ]

  return (
    <div className="p-6 max-w-3xl">
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {clientName ? `Hello, ${clientName.split(' ')[0]}` : 'Welcome'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Here&apos;s an overview of your portal.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {cards.map((card) => (
              <StatCard key={card.label} card={card} subdomain={subdomain} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
