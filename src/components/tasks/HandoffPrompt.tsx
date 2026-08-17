'use client'

import { X } from 'lucide-react'
import { useTeam } from '@/hooks/useTeam'
import { initials, avatarColor } from './TaskBits'

interface PickableMember {
  user_id: string
  name: string | null
  email: string | null
}

interface HandoffPromptProps {
  /** The task being moved — named in the sheet so it's clear what's changing hands. */
  taskTitle: string
  /** Where it's going. */
  stageName: string
  /** Whoever holds it now, shown as the current choice. */
  currentHolderId: string | null
  workspaceId: string | null | undefined
  onChoose: (userId: string) => void
  onCancel: () => void
  /** Supply the roster directly where there's no workspace team to read. */
  members?: PickableMember[]
}

/**
 * "Who's taking this on?" — shown when a task lands in a stage set to ask.
 *
 * A single sheet with the people in it, rather than a dialog wrapping a picker
 * that opens another sheet: choosing is one tap, because this interrupts a
 * drag and every extra tap is felt.
 *
 * Shared by the board and the task drawer on purpose. When only the board asked,
 * changing the stage from inside a task moved the work without passing the baton
 * — the rule was configured, and silently not applied.
 */
export default function HandoffPrompt({
  taskTitle, stageName, currentHolderId, workspaceId, onChoose, onCancel, members: provided,
}: HandoffPromptProps) {
  const { members: fromTeam } = useTeam(provided ? null : workspaceId ?? null)
  const members: PickableMember[] = provided
    ?? fromTeam.map((m) => ({ user_id: m.user_id, name: m.name ?? null, email: m.email ?? null }))

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4 animate-fadeIn"
      onClick={onCancel}
      /**
       * Mousedown stops here, at the sheet's own root.
       *
       * The task drawer closes itself on mousedown against its backdrop, and
       * this sheet mounts inside it — so pressing a name tore the drawer down
       * mid-press and the click never landed. The task appeared to do nothing.
       * Stopping it here keeps the sheet safe wherever it's mounted, rather
       * than relying on each host to guard it.
       */
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-xl animate-slideUp max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-2 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Who’s taking this on?</h2>
            <p className="mt-0.5 text-xs2 text-gray-500 break-words">
              Moving “{taskTitle}” to {stageName}. It comes off your desk and lands on theirs.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            // Not "Cancel" — the footer button already carries that name, and
            // two controls with the same accessible name is a coin toss for
            // anyone navigating by voice or screen reader.
            aria-label="Close"
            className="w-11 h-11 -mr-2 -mt-2 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-2 py-2">
          {members.length === 0 ? (
            <p className="px-3 py-6 text-sm text-gray-400 text-center">
              No teammates to hand this to yet.
            </p>
          ) : (
            members.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => onChoose(m.user_id)}
                className="w-full flex items-center gap-3 px-3 min-h-[44px] py-3 rounded-xl hover:bg-gray-50 text-left"
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: avatarColor(m.user_id) }}
                >
                  {initials(m.name ?? null, m.email ?? null)}
                </span>
                <span className="flex-1 min-w-0 text-sm text-gray-700 break-words">
                  {m.name || m.email || 'Member'}
                </span>
                {m.user_id === currentHolderId && (
                  <span className="text-2xs text-gray-400 flex-shrink-0">has it now</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-5 pt-1 pb-5 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="w-full min-h-[44px] rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:border-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
