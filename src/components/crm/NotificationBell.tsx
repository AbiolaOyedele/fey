'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/utils/formatDate'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useAppNotifications } from '@/hooks/useNotifications'
import type { AppNotification } from '@/types/notification'

/**
 * Desktop notification bell — anchored popover in the sidebar footer. New items
 * arrive in realtime. Clicking one marks it read and navigates to its link.
 */
export default function NotificationBell({ accent, expanded = false }: { accent: string; expanded?: boolean }) {
  const router = useRouter()
  const { items, unreadCount, markRead, markAllRead } = useAppNotifications()
  const [open, setOpen] = useState(false)
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        className={`flex items-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 relative ${
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
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">No notifications yet</div>
            ) : (
              items.slice(0, 30).map((n) => (
                <button
                  key={n.id}
                  onClick={() => onItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors ${!n.read_at ? 'bg-gray-50/60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
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
