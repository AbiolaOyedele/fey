'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MessageSquare, FileSignature, ClipboardList, CheckSquare2,
  ArrowRight, LayoutDashboard, Bell,
} from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { usePortalBase } from '@/hooks/usePortalBase'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { usePortalNotificationFeed } from '@/contexts/PortalNotificationsContext'
import { portalNotificationHref } from '@/utils/portalNotificationLink'
import { Stagger, StaggerItem, FadeIn } from '@/components/ui/motion'

/**
 * Dashboard — what needs the client's attention, then a way in.
 *
 * Built on the app's own card language (accent-driven, `font-display` heading,
 * 2xl radius, hairline border) so the portal reads as part of Fey rather than a
 * separate product. Counts are "waiting on you" totals, not vanity stats: a
 * zero here means there is genuinely nothing to do.
 */

interface Stat {
  label: string
  count: number
  icon: React.ElementType
  path: string
}

export default function PortalHome({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const base   = usePortalBase(subdomain)
  const accent = usePortalAccent(subdomain)
  const { notifications, unread, markRead } = usePortalNotificationFeed()

  const [unreadMessages, setUnreadMessages]     = useState(0)
  const [pendingContracts, setPendingContracts] = useState(0)
  const [pendingForms, setPendingForms]         = useState(0)
  const [openTasks, setOpenTasks]               = useState(0)
  const [loading, setLoading]                   = useState(true)
  const [clientName, setClientName]             = useState('')

  useEffect(() => {
    void (async () => {
      const token = localStorage.getItem(portalTokenKey(subdomain))
      if (!token) { setLoading(false); return }
      const headers = { Authorization: `Bearer ${token}` }

      const [msgsRes, contractsRes, formsRes, tasksRes, sessionRes] = await Promise.all([
        fetch('/api/v1/portal/messages',     { headers }),
        fetch('/api/v1/portal/contracts',    { headers }),
        fetch('/api/v1/portal/forms',        { headers }),
        fetch('/api/v1/portal/tasks',        { headers }),
        fetch('/api/v1/portal/auth/session', { headers }),
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
      if (tasksRes.ok) {
        // Tasks is best-effort on the dashboard: the section owns the real view,
        // this is only a count, so an unexpected shape just leaves it at zero.
        const d = await tasksRes.json().catch(() => null) as { tasks?: Array<{ status?: string }> } | null
        setOpenTasks((d?.tasks ?? []).filter((t) => t.status !== 'done' && t.status !== 'completed').length)
      }
      if (sessionRes.ok) {
        const d = await sessionRes.json() as { name: string }
        setClientName(d.name)
      }

      setLoading(false)
    })()
  }, [subdomain])

  const stats: Stat[] = [
    { label: 'Unread messages',   count: unreadMessages,   icon: MessageSquare, path: '/messages'  },
    { label: 'Contracts to sign', count: pendingContracts, icon: FileSignature, path: '/contracts' },
    { label: 'Forms to complete', count: pendingForms,     icon: ClipboardList, path: '/forms'     },
    { label: 'Open tasks',        count: openTasks,        icon: CheckSquare2,  path: '/tasks'     },
  ]

  const needsAttention = stats.reduce((sum, s) => sum + s.count, 0)
  const recent = notifications.slice(0, 4)

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="h-6 w-44 rounded-lg bg-gray-100 animate-pulse mb-2" />
        <div className="h-3 w-64 rounded-lg bg-gray-50 animate-pulse mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <LayoutDashboard size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800 truncate">
            {clientName ? `Hello, ${clientName.split(' ')[0]}` : 'Welcome'}
          </h1>
        </div>
        <p className="text-xs text-gray-400 mb-6">
          {needsAttention > 0
            ? `You have ${needsAttention} ${needsAttention === 1 ? 'thing' : 'things'} waiting on you.`
            : 'Nothing needs your attention right now.'}
        </p>
      </FadeIn>

      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl">
        {stats.map(({ label, count, icon: Icon, path }) => (
          <StaggerItem key={path} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={`${base}${path}`}
              className="group relative block h-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 overflow-hidden hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
                  style={{ backgroundColor: `${accent}15`, color: accent }}
                >
                  <Icon size={20} />
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
              </div>
              {/* Tabular figures so the row of counts doesn't jitter as they update. */}
              <p className="font-display text-2xl text-gray-800 tabular-nums leading-none">{count}</p>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{label}</p>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Recent activity — the same feed as the Notifications page, trimmed. */}
      <FadeIn>
        <div className="mt-8 max-w-4xl">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-2xs font-semibold uppercase tracking-widest text-gray-300">Recent activity</span>
            {unread > 0 && (
              <Link href={`${base}/notifications`} className="text-xs font-medium" style={{ color: accent }}>
                {unread} unread
              </Link>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
              <div className="w-11 h-11 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-3">
                <Bell size={18} />
              </div>
              <p className="text-sm text-gray-500">Nothing yet</p>
              <p className="text-xs text-gray-400 mt-1">Updates from the team will show up here.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
              {recent.map((n, i) => (
                <Link
                  key={n.id}
                  href={`${base}${portalNotificationHref(n)}`}
                  onClick={() => { if (!n.read_at) void markRead(n.id) }}
                  className={`flex items-start gap-3 p-4 min-h-[44px] hover:bg-gray-50/60 transition-colors ${i > 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: n.read_at ? '#E2E8F0' : accent }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-gray-700 truncate">{n.title}</span>
                    {n.body && <span className="block text-2xs text-gray-400 truncate mt-0.5">{n.body}</span>}
                  </span>
                </Link>
              ))}
              <Link
                href={`${base}/notifications`}
                className="flex items-center justify-center gap-1.5 p-3 min-h-[44px] border-t border-gray-50 text-xs font-medium text-gray-500 hover:bg-gray-50/60 transition-colors"
              >
                View all <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  )
}
