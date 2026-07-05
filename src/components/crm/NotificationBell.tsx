'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/utils/formatDate'
import {
  Bell,
  X,
  CheckCheck,
  MessageSquare,
  AtSign,
  UserPlus,
  FileText,
  FileSignature,
  CreditCard,
  ListTodo,
  Paperclip,
  Inbox,
} from 'lucide-react'
import { useAppNotifications } from '@/hooks/useNotifications'
import type { AppNotification } from '@/types/notification'

type Category = 'messages' | 'clients' | 'tasks'

/** Maps each notification type to a filter category and an icon. */
const TYPE_META: Record<string, { category: Category; icon: ReactNode }> = {
  client_message: { category: 'messages', icon: <MessageSquare size={15} /> },
  project_message: { category: 'messages', icon: <MessageSquare size={15} /> },
  mention: { category: 'messages', icon: <AtSign size={15} /> },
  client_signup: { category: 'clients', icon: <UserPlus size={15} /> },
  form_submitted: { category: 'clients', icon: <FileText size={15} /> },
  contract_signed: { category: 'clients', icon: <FileSignature size={15} /> },
  invoice_paid: { category: 'clients', icon: <CreditCard size={15} /> },
  task_assigned: { category: 'tasks', icon: <ListTodo size={15} /> },
  project_file: { category: 'tasks', icon: <Paperclip size={15} /> },
}

const FILTERS: { key: 'all' | Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'messages', label: 'Messages' },
  { key: 'clients', label: 'Clients' },
  { key: 'tasks', label: 'Tasks' },
]

const categoryOf = (n: AppNotification): Category | null => TYPE_META[n.type]?.category ?? null
const iconOf = (n: AppNotification): ReactNode => TYPE_META[n.type]?.icon ?? <Inbox size={15} />

/**
 * Desktop notification bell — anchored popover in the sidebar footer. New items
 * arrive in realtime. Items can be filtered by category. Clicking one marks it
 * read and navigates to its link.
 */
export default function NotificationBell({ accent, expanded = false }: { accent: string; expanded?: boolean }) {
  const router = useRouter()
  const { items, unreadCount, markRead, markAllRead } = useAppNotifications()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | Category>('all')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const onItem = (n: AppNotification) => {
    void markRead(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const visible = (filter === 'all' ? items : items.filter((n) => categoryOf(n) === filter)).slice(0, 30)

  return (
    <div ref={ref} className={`relative ${expanded ? 'w-full' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        className={`flex items-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${
          expanded ? 'w-full gap-3 px-3 h-10' : 'w-10 h-10 justify-center'
        }`}
      >
        <span className="relative flex-shrink-0">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
              style={{ backgroundColor: accent }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        {expanded && <span className="text-sm font-medium">Notifications</span>}
      </button>

      {open && (
        <div className="absolute left-full ml-2 bottom-0 w-80 bg-white border border-gray-100 rounded-2xl z-50 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={() => void markAllRead()} className="flex items-center gap-1 text-2xs text-gray-400 hover:text-gray-600" title="Mark all read">
                  <CheckCheck size={13} /> Mark all
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500"><X size={14} /></button>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 overflow-x-auto">
            {FILTERS.map((f) => {
              const active = filter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                    active ? '' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                  style={active ? { backgroundColor: `${accent}1a`, color: accent } : undefined}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">
                {filter === 'all' ? 'No notifications yet' : 'Nothing in this category'}
              </div>
            ) : (
              visible.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors ${!n.read_at ? 'bg-gray-50/60' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex-shrink-0 text-gray-400">{iconOf(n)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {!n.read_at && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />}
                        <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                      </div>
                      {n.body && <p className="text-xs2 text-gray-500 line-clamp-2">{n.body}</p>}
                      <p className="text-2xs text-gray-400 mt-0.5">{formatDateTime(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
