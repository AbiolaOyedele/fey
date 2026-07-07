'use client'

import { X, Plus, ListTodo, Clock3, CalendarDays } from 'lucide-react'
import type { SocialBrand, SocialPost, SocialPostStatus } from '@/types/social'
import { SOCIAL_POST_STATUSES } from '@/types/social'
import { STATUS_STYLES } from '@/components/playground/PostEditor'

interface DayPanelProps {
  dateKey: string
  posts: SocialPost[]
  brandById: Map<string, SocialBrand>
  accent: string
  onEdit: (post: SocialPost) => void
  onAdd: () => void
  onMarkTask: (post: SocialPost) => void
  onClose: () => void
}

function statusLabel(s: SocialPostStatus): string {
  return SOCIAL_POST_STATUSES.find((x) => x.value === s)?.label ?? s
}

function timeLabel(t: string | null): string {
  if (!t) return 'Anytime'
  const [h, m] = t.split(':').map(Number)
  const hr12 = ((h + 11) % 12) + 1
  return `${hr12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * Opens beside the collapsed calendar when a day is clicked — everything
 * scheduled that day, grouped per brand.
 */
export default function DayPanel({ dateKey, posts, brandById, accent, onEdit, onAdd, onMarkTask, onClose }: DayPanelProps) {
  const date = new Date(`${dateKey}T00:00:00`)
  const heading = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  // Group by brand, keeping the calendar's time order within each group.
  const groups = new Map<string, SocialPost[]>()
  for (const p of posts) {
    const list = groups.get(p.brand_id) ?? []
    list.push(p)
    groups.set(p.brand_id, list)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays size={15} style={{ color: accent }} className="flex-shrink-0" />
          <h3 className="text-sm font-semibold text-gray-800 truncate">{heading}</h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onAdd}
            title="Add a post to this day"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accent }}
          >
            <Plus size={15} />
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {posts.length === 0 ? (
          <div className="py-12 text-center">
            <CalendarDays size={28} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Nothing scheduled this day</p>
            <button onClick={onAdd} className="mt-2 text-xs font-medium hover:underline" style={{ color: accent }}>
              Plan the first post
            </button>
          </div>
        ) : (
          [...groups.entries()].map(([brandId, brandPosts]) => {
            const brand = brandById.get(brandId)
            return (
              <div key={brandId}>
                <div className="flex items-center gap-1.5 px-1 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: brand?.color ?? '#E5E7EB' }} />
                  <span className="text-xs font-semibold text-gray-600">{brand?.name ?? 'Brand'}</span>
                  <span className="text-2xs text-gray-300">{brandPosts.length}</span>
                </div>
                <div className="space-y-1.5">
                  {brandPosts.map((p) => {
                    const st = STATUS_STYLES[p.status]
                    return (
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onEdit(p)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onEdit(p) }}
                        className="w-full text-left rounded-xl border border-gray-100 p-3 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
                        style={{ borderLeft: `3px solid ${brand?.color ?? '#E5E7EB'}` }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-800 leading-snug">{p.title}</p>
                          <span
                            className="text-2xs font-medium px-2 py-0.5 rounded-md flex-shrink-0"
                            style={{ backgroundColor: st.bg, color: st.text }}
                          >
                            {statusLabel(p.status)}
                          </span>
                        </div>
                        {p.caption && <p className="text-xs text-gray-400 line-clamp-2 mb-1.5">{p.caption}</p>}
                        <div className="flex items-center gap-3 text-2xs text-gray-400">
                          <span className="inline-flex items-center gap-1"><Clock3 size={11} /> {timeLabel(p.scheduled_time)}</span>
                          {p.format && <span className="capitalize">{p.format}</span>}
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
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
