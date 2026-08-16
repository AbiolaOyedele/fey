'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useTeam } from '@/hooks/useTeam'
import { initials, avatarColor } from './TaskBits'

interface PickableMember {
  user_id: string
  name: string | null
  email: string | null
}

interface PersonPickerProps {
  workspaceId: string | null | undefined
  /** Currently chosen person, or null for nobody. */
  selectedId: string | null
  onChange: (userId: string | null) => void
  /** Heading on the sheet — say what the person is being picked FOR. */
  title: string
  /** Label shown on the trigger when nobody is chosen. */
  emptyLabel?: string
  /** Offers a "nobody" option. Off where a null choice makes no sense. */
  clearable?: boolean
  /** Text for the clear row, e.g. "Leave it with whoever has it". */
  clearLabel?: string
  /** Supply the roster directly (the portal has no workspace team to read). */
  members?: PickableMember[]
  disabled?: boolean
}

/**
 * Single-select teammate picker.
 *
 * Deliberately the same centred sheet as AssigneePicker rather than an anchored
 * dropdown: it has room for full names, and on a phone a dropdown near the
 * bottom of a drawer runs off-screen. Rows are 44px so they're tappable.
 */
export default function PersonPicker({
  workspaceId, selectedId, onChange, title, emptyLabel = 'Choose someone',
  clearable = false, clearLabel = 'Nobody', members: provided, disabled,
}: PersonPickerProps) {
  // Hooks can't be conditional, so the team hook still runs; it no-ops on a
  // null workspace, which is what the portal passes.
  const { members: fromTeam } = useTeam(provided ? null : workspaceId ?? null)
  const members: PickableMember[] = provided
    ?? fromTeam.map((m) => ({ user_id: m.user_id, name: m.name ?? null, email: m.email ?? null }))
  const [open, setOpen] = useState(false)

  const selected = members.find((m) => m.user_id === selectedId) ?? null
  const label = selected ? (selected.name || selected.email || 'Teammate') : emptyLabel

  const choose = (userId: string | null) => {
    onChange(userId)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center gap-2 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 text-sm text-gray-600 max-w-full disabled:opacity-50 disabled:hover:border-gray-200"
      >
        {selected ? (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0"
            style={{ backgroundColor: avatarColor(selected.user_id) }}
          >
            {initials(selected.name, selected.email)}
          </span>
        ) : (
          <span className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-[10px] flex-shrink-0">
            +
          </span>
        )}
        <span className={`text-xs2 truncate ${selected ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
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
              <h2 className="text-base font-semibold text-gray-900 pr-2">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-11 h-11 -mr-2 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-2 pb-5">
              {clearable && (
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="w-full flex items-center gap-3 px-3 min-h-[44px] py-3 rounded-xl hover:bg-gray-50 text-left"
                >
                  <span className="w-9 h-9 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-300 flex-shrink-0">
                    —
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-gray-500 break-words">{clearLabel}</span>
                  {selectedId === null && <Check size={16} className="text-gray-500 flex-shrink-0" />}
                </button>
              )}

              {members.length === 0 ? (
                <p className="px-3 py-4 text-sm text-gray-400 text-center">No teammates yet</p>
              ) : (
                members.map((m) => (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => choose(m.user_id)}
                    className="w-full flex items-center gap-3 px-3 min-h-[44px] py-3 rounded-xl hover:bg-gray-50 text-left"
                  >
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: avatarColor(m.user_id) }}
                    >
                      {initials(m.name ?? null, m.email ?? null)}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-gray-700 break-words">{m.name || m.email || 'Member'}</span>
                    {selectedId === m.user_id && <Check size={16} className="text-gray-500 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
