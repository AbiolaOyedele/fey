'use client'

import { Flag } from 'lucide-react'
import HoverTip from '@/components/ui/HoverTip'
import type { TaskPriority, TaskAssignee } from '@/types/work-tasks'

// Shared presentational bits for the task views. Pure, no data fetching.

export const PRIORITY_META: Record<TaskPriority, { label: string; text: string; bg: string; flag: string }> = {
  high:   { label: 'High',   text: 'text-red-600',   bg: 'bg-red-50',   flag: '#EF4444' },
  medium: { label: 'Medium', text: 'text-amber-600', bg: 'bg-amber-50', flag: '#F59E0B' },
  low:    { label: 'Low',    text: 'text-green-600',  bg: 'bg-green-50', flag: '#22C55E' },
}

export function PriorityFlag({ priority }: { priority: TaskPriority }) {
  return (
    <HoverTip label={`${PRIORITY_META[priority].label} priority`}>
      <Flag size={14} style={{ color: PRIORITY_META[priority].flag }} fill={PRIORITY_META[priority].flag} />
    </HoverTip>
  )
}

export function PriorityPill({ priority }: { priority: TaskPriority }) {
  const m = PRIORITY_META[priority]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs2 font-medium ${m.bg} ${m.text}`}>
      <Flag size={12} fill={m.flag} style={{ color: m.flag }} />
      {m.label}
    </span>
  )
}

export function initials(name: string | null, email: string | null): string {
  const src = (name ?? email ?? '?').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

// Deterministic avatar color from the user id so the same person stays one color.
const AVATAR_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
export function avatarColor(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function AssigneeAvatars({ assignees, size = 22 }: { assignees: TaskAssignee[]; size?: number }) {
  if (assignees.length === 0) {
    return (
      <span
        className="rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-300"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        +
      </span>
    )
  }
  return (
    <div className="flex -space-x-1.5">
      {assignees.slice(0, 3).map((a) => (
        <HoverTip key={a.user_id} label={a.name ?? a.email ?? 'Teammate'}>
          <span
            className="rounded-full flex items-center justify-center text-white font-semibold ring-2 ring-white"
            style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: avatarColor(a.user_id) }}
          >
            {initials(a.name, a.email)}
          </span>
        </HoverTip>
      ))}
      {assignees.length > 3 && (
        <span
          className="rounded-full flex items-center justify-center bg-gray-200 text-gray-600 font-semibold ring-2 ring-white"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          +{assignees.length - 3}
        </span>
      )}
    </div>
  )
}

function localToday(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export function formatDue(due: string): string {
  const today = localToday()
  if (due === today) return 'Today'
  const n = new Date(); n.setDate(n.getDate() + 1)
  const tomorrow = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  if (due === tomorrow) return 'Tomorrow'
  const d = new Date(due + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function DueChip({ due, done }: { due: string | null; done: boolean }) {
  if (!due) return <span className="text-2xs text-gray-300">—</span>
  const today = localToday()
  const overdue = !done && due < today
  const isToday = due === today
  return (
    <span className={`text-xs2 font-medium ${overdue ? 'text-red-500' : isToday ? 'text-blue-500' : 'text-gray-500'}`}>
      {formatDue(due)}
    </span>
  )
}

export function formatMinutes(min: number | null): string {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/** Parses "6h", "1h 30m", "90m", "90" into minutes (null if blank/invalid). */
export function parseEstimate(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  const hMatch = s.match(/(\d+(?:\.\d+)?)\s*h/)
  const mMatch = s.match(/(\d+)\s*m/)
  if (hMatch || mMatch) {
    const h = hMatch ? parseFloat(hMatch[1]) : 0
    const m = mMatch ? parseInt(mMatch[1], 10) : 0
    return Math.round(h * 60 + m)
  }
  const num = parseInt(s, 10)
  return Number.isFinite(num) ? num : null
}
