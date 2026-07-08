'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useTeam } from '@/hooks/useTeam'
import { AssigneeAvatars, initials, avatarColor } from './TaskBits'
import type { TaskAssignee } from '@/types/work-tasks'

interface AssigneePickerProps {
  workspaceId: string | null | undefined
  selectedIds: string[]
  onChange: (userIds: string[]) => void
}

/** Multi-select assignee button — opens a centered popup (not an anchored
 *  dropdown) so it has room to show full names instead of truncating them,
 *  and works the same on mobile where a dropdown would run off-screen. */
export default function AssigneePicker({ workspaceId, selectedIds, onChange }: AssigneePickerProps) {
  const { members } = useTeam(workspaceId ?? null)
  const [open, setOpen] = useState(false)

  const selected: TaskAssignee[] = members
    .filter((m) => selectedIds.includes(m.user_id))
    .map((m) => ({ user_id: m.user_id, name: m.name ?? null, email: m.email ?? null }))

  const toggle = (userId: string) => {
    onChange(selectedIds.includes(userId) ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId])
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 text-sm text-gray-600"
      >
        <AssigneeAvatars assignees={selected} size={20} />
        <span className="text-xs2 text-gray-500">{selected.length ? 'Assigned' : 'Assign'}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/30 p-4 animate-fadeIn"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-xl animate-slideUp max-h-[80dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Assign to</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-2 pb-2">
              {members.length === 0 ? (
                <p className="px-3 py-4 text-sm text-gray-400 text-center">No teammates yet</p>
              ) : (
                members.map((m) => {
                  const isSel = selectedIds.includes(m.user_id)
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => toggle(m.user_id)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 text-left"
                    >
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{ backgroundColor: avatarColor(m.user_id) }}
                      >
                        {initials(m.name ?? null, m.email ?? null)}
                      </span>
                      <span className="flex-1 min-w-0 text-sm text-gray-700 break-words">{m.name || m.email || 'Member'}</span>
                      {isSel && <Check size={16} className="text-gray-500 flex-shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>

            <div className="px-5 pt-1 pb-5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full h-10 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
