'use client'

import { useMemo } from 'react'
import type { SocialBrand, SocialPost } from '@/types/social'
import { toDateKey } from '@/hooks/useSocialPlanner'

interface SocialCalendarProps {
  month: Date
  postsByDay: Map<string, SocialPost[]>
  brandById: Map<string, SocialBrand>
  selectedDay: string | null
  /** True when the day panel is open and the grid is in its narrow state. */
  compact: boolean
  accent: string
  onSelectDay: (dateKey: string) => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "14:00:00" → "2pm", "14:30:00" → "2:30pm" */
function timeChip(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const hr12 = ((h + 11) % 12) + 1
  return m ? `${hr12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}` : `${hr12}${h < 12 ? 'am' : 'pm'}`
}

/**
 * Month grid. Every cell is a drop-in for the day: color-coded chips per post,
 * click anywhere in the cell to open that day's panel.
 */
export default function SocialCalendar({
  month, postsByDay, brandById, selectedDay, compact, accent, onSelectDay,
}: SocialCalendarProps) {
  const todayKey = toDateKey(new Date())

  // Monday-first grid covering the whole month, padded to full weeks.
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const lead = (first.getDay() + 6) % 7 // days to back-fill before the 1st
    const start = new Date(first)
    start.setDate(first.getDate() - lead)
    const cells: { key: string; date: Date; inMonth: boolean }[] = []
    const cursor = new Date(start)
    do {
      cells.push({ key: toDateKey(cursor), date: new Date(cursor), inMonth: cursor.getMonth() === month.getMonth() })
      cursor.setDate(cursor.getDate() + 1)
    } while (cursor.getMonth() === month.getMonth() || cells.length % 7 !== 0)
    return cells
  }, [month])

  const maxChips = compact ? 2 : 3

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-2xs font-semibold text-gray-400 uppercase tracking-wide">
            {compact ? d.charAt(0) : d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(({ key, date, inMonth }) => {
          const posts = postsByDay.get(key) ?? []
          const isToday = key === todayKey
          const isSelected = key === selectedDay
          return (
            <button
              key={key}
              onClick={() => onSelectDay(key)}
              className={`relative flex flex-col items-stretch gap-1 border-b border-r border-gray-50 p-1.5 text-left transition-colors min-h-[72px] ${compact ? 'md:min-h-[64px]' : 'md:min-h-[104px]'} ${
                inMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/60 hover:bg-gray-50'
              }`}
              style={isSelected ? { boxShadow: `inset 0 0 0 2px ${accent}` } : undefined}
            >
              <span
                className={`self-start text-xs font-medium w-6 h-6 rounded-full flex items-center justify-center ${
                  inMonth ? 'text-gray-700' : 'text-gray-300'
                }`}
                style={isToday ? { backgroundColor: accent, color: '#fff' } : undefined}
              >
                {date.getDate()}
              </span>

              {posts.slice(0, maxChips).map((p) => {
                const brand = brandById.get(p.brand_id)
                return (
                  <span
                    key={p.id}
                    className="text-2xs leading-tight text-gray-700 rounded-md px-1.5 py-1 truncate"
                    style={{ backgroundColor: brand?.color ?? '#F3F4F6' }}
                    title={`${brand?.name ?? ''} — ${p.title}`}
                  >
                    {p.scheduled_time && <span className="font-semibold mr-1">{timeChip(p.scheduled_time)}</span>}
                    {p.title}
                  </span>
                )
              })}
              {posts.length > maxChips && (
                <span className="text-3xs text-gray-400 px-1.5">+{posts.length - maxChips} more</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
