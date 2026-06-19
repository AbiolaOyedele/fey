'use client'

import { useState, useRef, useEffect } from 'react'
import { Check } from 'lucide-react'
import { useTeam } from '@/hooks/useTeam'
import { AssigneeAvatars, initials, avatarColor } from './TaskBits'
import type { TaskAssignee } from '@/types/work-tasks'

interface AssigneePickerProps {
  workspaceId: string | null | undefined
  selectedIds: string[]
  onChange: (userIds: string[]) => void
}

/** Multi-select assignee popover backed by the active workspace's members. */
export default function AssigneePicker({ workspaceId, selectedIds, onChange }: AssigneePickerProps) {
  const { members } = useTeam(workspaceId ?? null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const selected: TaskAssignee[] = members
    .filter((m) => selectedIds.includes(m.user_id))
    .map((m) => ({ user_id: m.user_id, name: m.name ?? null, email: m.email ?? null }))

  const toggle = (userId: string) => {
    onChange(selectedIds.includes(userId) ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId])
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 text-sm text-gray-600"
      >
        <AssigneeAvatars assignees={selected} size={20} />
        <span className="text-xs2 text-gray-500">{selected.length ? 'Assigned' : 'Assign'}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-60 max-h-64 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-100 py-1">
          {members.length === 0 ? (
            <p className="px-3 py-2 text-xs2 text-gray-400">No teammates yet</p>
          ) : (
            members.map((m) => {
              const isSel = selectedIds.includes(m.user_id)
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => toggle(m.user_id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left"
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-2xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: avatarColor(m.user_id) }}
                  >
                    {initials(m.name ?? null, m.email ?? null)}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{m.name || m.email || 'Member'}</span>
                  {isSel && <Check size={14} className="text-gray-500 flex-shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
