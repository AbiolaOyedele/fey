'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  Bell, MessageSquare, Folder, FileSignature, ClipboardList,
  FileText, CreditCard, CheckSquare2, CheckCheck,
} from 'lucide-react'
import { usePortalBase } from '@/hooks/usePortalBase'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { usePortalNotifications } from '@/hooks/usePortalNotifications'
import { FadeIn } from '@/components/ui/motion'
import { relativeTime } from '@/utils/relativeTime'
import type { PortalNotification } from '@/types/portal-notification'

/**
 * The client's notification feed — the other half of the notifications the
 * owner already gets. Grouped Today / Earlier, unread called out with the
 * workspace accent, and opening one marks it read on the way through.
 */

const ICON_FOR_TYPE: Record<string, React.ElementType> = {
  message:  MessageSquare,
  file:     Folder,
  contract: FileSignature,
  form:     ClipboardList,
  invoice:  FileText,
  payment:  CreditCard,
  task:     CheckSquare2,
}

export default function PortalNotificationsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const base   = usePortalBase(subdomain)
  const accent = usePortalAccent(subdomain)
  const { notifications, unread, loading, markRead, markAllRead } = usePortalNotifications(subdomain)

  // Grouped client-side: the feed is capped at 50, so this is cheap and avoids
  // a second endpoint just to bucket by day.
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const cutoff = startOfToday.getTime()
  const today   = notifications.filter((n) => new Date(n.created_at).getTime() >= cutoff)
  const earlier = notifications.filter((n) => new Date(n.created_at).getTime() < cutoff)

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <Bell size={18} style={{ color: accent }} className="flex-shrink-0" />
            <h1 className="font-display text-xl font-normal text-gray-800 truncate">Notifications</h1>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 h-11 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors active:scale-[0.98] flex-shrink-0"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-6">
          {unread > 0 ? `${unread} unread` : 'You’re all caught up.'}
        </p>
      </FadeIn>

      {loading ? (
        <div className="space-y-2 max-w-2xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="max-w-2xl rounded-2xl border border-gray-100 bg-white p-10 text-center">
          <div className="w-11 h-11 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-4">
            <Bell size={18} />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">No notifications yet</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            When the team sends you a message, file, contract or invoice, it’ll show up here.
          </p>
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {today.length > 0 && (
            <Group title="Today" items={today} base={base} accent={accent} onOpen={markRead} />
          )}
          {earlier.length > 0 && (
            <Group title="Earlier" items={earlier} base={base} accent={accent} onOpen={markRead} />
          )}
        </div>
      )}
    </div>
  )
}

function Group({
  title, items, base, accent, onOpen,
}: {
  title: string
  items: PortalNotification[]
  base: string
  accent: string
  onOpen: (id: string) => Promise<void>
}) {
  return (
    <div>
      <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">{title}</span>
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        {items.map((n, i) => {
          const Icon = ICON_FOR_TYPE[n.type] ?? Bell
          const isUnread = !n.read_at
          return (
            <Link
              key={n.id}
              href={`${base}${n.link ?? '/notifications'}`}
              onClick={() => { if (isUnread) void onOpen(n.id) }}
              className={`flex items-start gap-3 p-4 min-h-[44px] transition-colors hover:bg-gray-50/60 ${i > 0 ? 'border-t border-gray-50' : ''}`}
              style={isUnread ? { backgroundColor: `${accent}08` } : undefined}
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: isUnread ? `${accent}15` : '#F7F7F8', color: isUnread ? accent : '#A0AEC0' }}
              >
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs leading-relaxed ${isUnread ? 'font-semibold text-gray-800' : 'font-medium text-gray-600'}`}>
                  {n.title}
                </span>
                {n.body && <span className="block text-2xs text-gray-400 leading-relaxed mt-0.5 line-clamp-2">{n.body}</span>}
                <span className="block text-2xs text-gray-300 mt-1">{relativeTime(n.created_at)}</span>
              </span>
              {isUnread && (
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
