'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Grid, Columns3, Clock3, ListTodo, Plus, CalendarDays } from 'lucide-react'
import type { SocialBrand, SocialPost, SocialPostStatus } from '@/types/social'
import { SOCIAL_POST_STATUSES } from '@/types/social'
import { STATUS_STYLES } from '@/components/playground/PostEditor'
import { toDateKey } from '@/hooks/useSocialPlanner'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "14:30:00" → "2:30 PM", null → "Anytime". */
function timeLabel(t: string | null): string {
  if (!t) return 'Anytime'
  const [h, m] = t.split(':').map(Number)
  const hr12 = ((h + 11) % 12) + 1
  return `${hr12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function statusLabel(s: SocialPostStatus): string {
  return SOCIAL_POST_STATUSES.find((x) => x.value === s)?.label ?? s
}

interface SocialCalendarBoardProps {
  month: Date
  postsByDay: Map<string, SocialPost[]>
  brandById: Map<string, SocialBrand>
  selectedDay: string | null
  accent: string
  onSelectDay: (dateKey: string) => void
  onEditPost: (post: SocialPost) => void
  onAddPost: (dateKey: string) => void
  onMarkTask: (post: SocialPost) => void
}

/**
 * Social Corner · corner-badge board (full-swap experiment).
 *
 * Month grid where each day carries a corner post-count badge that springs to
 * the centre on hover, paired with a slide-out list of the month's posts — the
 * hovered/selected day floats to the top. Rebuilt in Fey's light design system
 * (NoirPro, accent + per-brand colours) from a dark reference component.
 */
export default function SocialCalendarBoard({
  month, postsByDay, brandById, selectedDay, accent,
  onSelectDay, onEditPost, onAddPost, onMarkTask,
}: SocialCalendarBoardProps) {
  const [listOpen, setListOpen] = useState(false)
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const todayKey = toDateKey(new Date())

  // Monday-first grid covering the whole month, padded to full weeks.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const lead = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(first.getDate() - lead)
    const out: { key: string; date: Date; inMonth: boolean }[] = []
    const cursor = new Date(start)
    do {
      out.push({ key: toDateKey(cursor), date: new Date(cursor), inMonth: cursor.getMonth() === month.getMonth() })
      cursor.setDate(cursor.getDate() + 1)
    } while (cursor.getMonth() === month.getMonth() || out.length % 7 !== 0)
    return out
  }, [month])

  // Which day the list should surface first: whatever's hovered, else the selected day.
  const focusDay = hoveredDay ?? selectedDay

  // Day-keys in this month that actually have posts, sorted; focus day floats first.
  const listDays = useMemo(() => {
    const keys = [...postsByDay.keys()]
      .filter((k) => {
        const d = new Date(`${k}T00:00:00`)
        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
      })
      .sort()
    if (!focusDay) return keys
    return [...keys].sort((a, b) => (a === focusDay ? -1 : b === focusDay ? 1 : 0))
  }, [postsByDay, month, focusDay])

  const monthPostCount = listDays.reduce((n, k) => n + (postsByDay.get(k)?.length ?? 0), 0)

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div className={`w-full min-w-0 transition-all duration-300 ${listOpen ? 'lg:w-[56%]' : 'lg:w-full'}`}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-normal text-gray-800">
              {month.toLocaleDateString('en-GB', { month: 'long' })}{' '}
              <span className="text-gray-300">{month.getFullYear()}</span>
            </h2>

            {/* Grid ↔ list toggle (sliding pill) */}
            <div className="relative flex items-center rounded-lg bg-gray-100 p-0.5">
              <span
                aria-hidden
                className="absolute top-0.5 bottom-0.5 w-8 rounded-md bg-white shadow-sm transition-transform duration-300"
                style={{ transform: listOpen ? 'translateX(calc(100% + 0.125rem))' : 'translateX(0)' }}
              />
              <button
                onClick={() => setListOpen(false)}
                title="Grid only"
                aria-pressed={!listOpen}
                className="relative z-[1] w-8 h-7 flex items-center justify-center rounded-md"
              >
                <Grid size={15} className={listOpen ? 'text-gray-400' : 'text-gray-700'} />
              </button>
              <button
                onClick={() => setListOpen(true)}
                title="Show list"
                aria-pressed={listOpen}
                className="relative z-[1] w-8 h-7 flex items-center justify-center rounded-md"
              >
                <Columns3 size={15} className={listOpen ? 'text-gray-700' : 'text-gray-400'} />
              </button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-3xs sm:text-2xs font-semibold text-gray-400 uppercase tracking-wide py-1">
                <span className="sm:hidden">{d.charAt(0)}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {cells.map(({ key, date, inMonth }) => {
              const posts = postsByDay.get(key) ?? []
              const count = posts.length
              const isToday = key === todayKey
              const isSelected = key === selectedDay
              const isHovered = hoveredDay === key
              const brandColors = [...new Set(posts.map((p) => p.brand_id))]
                .map((id) => brandById.get(id)?.color)
                .filter((c): c is string => Boolean(c))

              return (
                <button
                  key={key}
                  onClick={() => { onSelectDay(key); if (count) setListOpen(true) }}
                  onMouseEnter={() => setHoveredDay(key)}
                  onMouseLeave={() => setHoveredDay((c) => (c === key ? null : c))}
                  className={`group relative flex flex-col rounded-xl p-1.5 text-left transition-colors min-h-[58px] sm:min-h-[78px] ${
                    inMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/60'
                  }`}
                  style={isSelected ? { boxShadow: `inset 0 0 0 2px ${accent}` } : undefined}
                  aria-label={`${date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${
                    count ? `, ${count} post${count === 1 ? '' : 's'}` : ''
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      inMonth ? 'text-gray-700' : 'text-gray-300'
                    }`}
                    style={isToday ? { backgroundColor: `var(--accent-fill, ${accent})`, color: '#fff' } : undefined}
                  >
                    {date.getDate()}
                  </span>

                  {/* Brand dots — keeps some at-a-glance context the count alone loses */}
                  {brandColors.length > 0 && (
                    <span className="mt-auto flex items-center gap-0.5 pl-0.5">
                      {brandColors.slice(0, 3).map((c, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                      {brandColors.length > 3 && <span className="text-4xs text-gray-400 leading-none">+{brandColors.length - 3}</span>}
                    </span>
                  )}

                  {/* Corner count → springs to centre on hover (shared layoutId) */}
                  {count > 0 && !isHovered && (
                    <motion.span
                      layoutId={`social-count-${key}`}
                      className="absolute bottom-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-4xs font-bold text-white"
                      style={{ backgroundColor: `var(--accent-fill, ${accent})` }}
                    >
                      {count}
                    </motion.span>
                  )}
                  <AnimatePresence>
                    {count > 0 && isHovered && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <motion.span
                          layoutId={`social-count-${key}`}
                          className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white shadow-md"
                          style={{ backgroundColor: `var(--accent-fill, ${accent})` }}
                        >
                          {count}
                        </motion.span>
                      </div>
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Slide-out list ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {listOpen && (
          <motion.div
            key="social-list"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full lg:w-[44%] min-w-0"
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-display text-base text-gray-800">Scheduled posts</h3>
                <p className="text-2xs text-gray-400">
                  {monthPostCount} this month{focusDay ? ' · hovered day floats up' : ''}
                </p>
              </div>

              <div className="max-h-[440px] lg:max-h-[calc(100vh-18rem)] overflow-y-auto p-2 space-y-2">
                {listDays.length === 0 ? (
                  <div className="py-14 text-center">
                    <CalendarDays size={26} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">Nothing scheduled this month</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {listDays.map((k) => {
                      const dayPosts = postsByDay.get(k) ?? []
                      const d = new Date(`${k}T00:00:00`)
                      const heading = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                      const isFocus = k === focusDay
                      return (
                        <motion.div
                          key={k}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                          className={`rounded-xl p-2 transition-colors ${isFocus ? 'bg-gray-50' : ''}`}
                        >
                          <div className="flex items-center justify-between px-1 mb-1.5">
                            <span className="text-2xs font-semibold uppercase tracking-wide text-gray-400">{heading}</span>
                            <button
                              onClick={() => onAddPost(k)}
                              title="Add a post to this day"
                              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {dayPosts.map((p) => {
                              const brand = brandById.get(p.brand_id)
                              const st = STATUS_STYLES[p.status]
                              return (
                                <div
                                  key={p.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => onEditPost(p)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onEditPost(p) }}
                                  className="rounded-xl border border-gray-100 bg-white p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: brand?.color ?? '#E5E7EB' }} />
                                      <p className="text-sm font-medium text-gray-800 leading-snug truncate">{p.title}</p>
                                    </div>
                                    <span
                                      className="text-3xs font-medium px-2 py-0.5 rounded-md flex-shrink-0"
                                      style={{ backgroundColor: st.bg, color: st.text }}
                                    >
                                      {statusLabel(p.status)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-2xs text-gray-400 pl-3.5">
                                    <span className="inline-flex items-center gap-1"><Clock3 size={11} /> {timeLabel(p.scheduled_time)}</span>
                                    {brand && <span className="truncate max-w-[80px]">{brand.name}</span>}
                                    {p.work_task_id ? (
                                      <span className="inline-flex items-center gap-1 text-gray-500"><ListTodo size={11} /> Task</span>
                                    ) : (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onMarkTask(p) }}
                                        className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                                        title="Add to the Tasks page"
                                      >
                                        <ListTodo size={11} /> Make task
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
