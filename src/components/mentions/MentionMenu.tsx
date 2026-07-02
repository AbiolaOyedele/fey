'use client'

import type { WorkspaceMember } from '@/types/team'

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const src = (name ?? email ?? '?').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function avatarColor(userId: string): string {
  const palette = ['#F472B6', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F87171', '#38BDF8', '#FB923C']
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

interface MentionMenuProps {
  matches: WorkspaceMember[]
  activeIndex: number
  onPick: (member: WorkspaceMember) => void
  onHover: (index: number) => void
  /** Positioning class — caller controls placement (below a textarea vs. below a toolbar). */
  className?: string
}

/** @mention autocomplete popover. Row markup mirrors AssigneePicker.tsx. */
export default function MentionMenu({ matches, activeIndex, onPick, onHover, className = '' }: MentionMenuProps) {
  if (matches.length === 0) {
    return (
      <div className={`z-50 w-60 bg-white rounded-xl shadow-xl border border-gray-100 py-1 ${className}`}>
        <p className="px-3 py-2 text-xs2 text-gray-400">No matching teammates</p>
      </div>
    )
  }

  return (
    <div className={`z-50 w-60 max-h-56 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-100 py-1 ${className}`}>
      {matches.map((m, i) => (
        <button
          key={m.user_id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(m) }}
          onMouseEnter={() => onHover(i)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${i === activeIndex ? 'bg-gray-50' : ''}`}
        >
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-2xs font-semibold flex-shrink-0"
            style={{ backgroundColor: avatarColor(m.user_id) }}
          >
            {initials(m.name, m.email)}
          </span>
          <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{m.name || m.email || 'Member'}</span>
        </button>
      ))}
    </div>
  )
}
