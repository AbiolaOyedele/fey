'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/hooks/useCrm'

export default function NotificationBell({ accent }: { accent: string }) {
  const { user } = useAuth()
  const { notifications, unreadCount, markAllRead } = useNotifications(user?.id ?? null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) void markAllRead()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 top-0 w-72 bg-white border border-gray-100 rounded-2xl z-50 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 last:border-b-0 ${!n.read_at ? 'bg-gray-50/50' : ''}`}
                >
                  <p className="text-sm text-gray-700">{n.message}</p>
                  <p className="text-2xs text-gray-400 mt-0.5">
                    {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
