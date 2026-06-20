'use client'

import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { useAppNotifications } from '@/hooks/useNotifications'
import { usePushSubscription } from '@/hooks/usePush'
import { formatDateTime } from '@/utils/formatDate'
import type { AppNotification } from '@/types/notification'

export default function NotificationsPage() {
  const router = useRouter()
  const { items, unreadCount, loading, markRead, markAllRead } = useAppNotifications()
  const push = usePushSubscription()

  const onItem = (n: AppNotification) => {
    void markRead(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="p-4 lg:p-8 page-enter max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={() => void markAllRead()} className="flex items-center gap-1.5 text-xs2 font-medium text-gray-500 hover:text-gray-700">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {/* Push opt-in */}
      {push.supported && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800">Push notifications</p>
            <p className="text-2xs text-gray-400">
              {push.subscribed ? 'On — alerts reach this device even when the app is closed.' : 'Get alerts on this device even when the app is closed.'}
            </p>
          </div>
          <button
            onClick={() => void (push.subscribed ? push.unsubscribe() : push.subscribe())}
            disabled={push.busy || push.permission === 'denied'}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs2 font-semibold transition-colors disabled:opacity-50 ${push.subscribed ? 'bg-gray-100 text-gray-600' : 'text-white'}`}
            style={!push.subscribed ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
          >
            {push.permission === 'denied' ? 'Blocked' : push.subscribed ? 'Turn off' : push.busy ? '…' : 'Turn on'}
          </button>
        </div>
      )}
      {push.permission === 'denied' && (
        <p className="text-2xs text-gray-400 mb-4">Notifications are blocked in your browser settings — enable them there to turn this on.</p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell size={30} strokeWidth={1.5} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">No notifications yet</p>
          <p className="text-xs2 text-gray-400 mt-0.5">Client messages, tasks and project activity will show up here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => onItem(n)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read_at ? 'bg-gray-50/60' : ''}`}
            >
              <div className="flex items-start gap-2.5">
                {!n.read_at && <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--accent, #ED64A6)' }} />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{n.title}</p>
                  {n.body && <p className="text-xs2 text-gray-500">{n.body}</p>}
                  <p className="text-2xs text-gray-400 mt-0.5">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
