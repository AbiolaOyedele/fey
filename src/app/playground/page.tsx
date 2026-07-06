'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shapes, Megaphone, CalendarDays, ArrowRight, Lock } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'

/**
 * Playground — a hub of experimental mini-apps. Each corner opens a focused
 * interface of its own. Social Corner is the first; more will join it.
 */
export default function PlaygroundPage() {
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const router = useRouter()
  const searchParams = useSearchParams()

  // Legacy deep links: Internal Chats used to live at /playground. Mention
  // notifications stored links like /playground?channel=...&message=... —
  // forward them to the chat page so old notifications keep working.
  useEffect(() => {
    const channel = searchParams.get('channel')
    if (!channel) return
    const message = searchParams.get('message')
    router.replace(`/chats?channel=${channel}${message ? `&message=${message}` : ''}`)
  }, [searchParams, router])

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <div className="flex items-center gap-2 mb-1">
        <Shapes size={18} style={{ color: accent }} />
        <h1 className="font-display text-xl font-normal text-gray-800">Playground</h1>
      </div>
      <p className="text-xs text-gray-400 mb-6">Mini-apps for the work around the work. Pick a corner.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-4xl">
        {/* Social Corner */}
        <Link
          href="/playground/social"
          className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
            style={{ backgroundColor: `${accent}15`, color: accent }}
          >
            <Megaphone size={20} />
          </div>
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Social Corner</h2>
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            Plan content calendars per brand — schedule posts, review, approve, and turn them into tasks.
          </p>
          <span
            className="inline-flex items-center gap-1 text-xs font-medium transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ color: accent }}
          >
            Open <ArrowRight size={13} />
          </span>
          <CalendarDays
            size={96}
            className="absolute -bottom-5 -right-5 text-gray-50 group-hover:text-gray-100 transition-colors pointer-events-none"
          />
        </Link>

        {/* Coming soon */}
        <div className="rounded-2xl border border-dashed border-gray-200 p-5 flex flex-col items-start justify-center min-h-[176px]">
          <div className="w-11 h-11 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center mb-4">
            <Lock size={18} />
          </div>
          <h2 className="text-sm font-semibold text-gray-400 mb-1">More corners coming</h2>
          <p className="text-xs text-gray-300 leading-relaxed">New mini-apps will land here as they’re built.</p>
        </div>
      </div>
    </div>
  )
}
