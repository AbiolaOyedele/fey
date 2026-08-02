'use client'

import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { QUICK_REACTIONS, type ReactionSummary } from '@/types/chat'

/**
 * The reaction strip under a message, plus the picker to add one.
 *
 * Shared by internal chat, CRM messages and the portal — reactions look and
 * behave the same everywhere, and the only thing a caller supplies is the
 * summary and a toggle.
 *
 * Names are in the title attribute rather than always visible: a busy message
 * would otherwise turn into a wall of text, but "who liked this?" is still one
 * hover (or long-press) away.
 */

interface MessageReactionsProps {
  summaries: ReactionSummary[]
  accent: string
  /** Hidden while a message is deleted or the viewer is read-only. */
  canReact: boolean
  onToggle: (emoji: string) => void
  /** Mirrors the bubble's alignment so the strip sits under the right edge. */
  align?: 'start' | 'end'
}

export default function MessageReactions({
  summaries, accent, canReact, onToggle, align = 'start',
}: MessageReactionsProps) {
  const [picking, setPicking] = useState(false)

  if (summaries.length === 0 && !canReact) return null

  return (
    <div className={`relative flex items-center gap-1 flex-wrap mt-1 ${align === 'end' ? 'justify-end' : ''}`}>
      {summaries.map((s) => (
        <button
          key={s.emoji}
          type="button"
          disabled={!canReact}
          onClick={() => onToggle(s.emoji)}
          title={s.names.join(', ')}
          aria-label={`${s.emoji} ${s.count} — ${s.names.join(', ')}`}
          className="inline-flex items-center gap-1 px-2 h-7 rounded-full border text-xs transition-colors disabled:cursor-default"
          style={s.mine
            ? { borderColor: accent, backgroundColor: `${accent}14`, color: '#374151' }
            : { borderColor: '#F1F1F1', backgroundColor: '#FAFAFA', color: '#6B7280' }}
        >
          <span aria-hidden>{s.emoji}</span>
          <span className="tabular-nums text-2xs">{s.count}</span>
        </button>
      ))}

      {canReact && (
        <>
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            aria-label="Add a reaction"
            aria-expanded={picking}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <SmilePlus size={14} />
          </button>

          {picking && (
            <>
              {/* Click-away layer — a reaction picker that traps you is worse
                  than one that closes too eagerly. */}
              <button
                type="button"
                aria-label="Close reaction picker"
                onClick={() => setPicking(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div
                className={`absolute bottom-8 z-50 flex items-center gap-0.5 bg-white rounded-full border border-gray-100 shadow-lg px-1.5 py-1 ${
                  align === 'end' ? 'right-0' : 'left-0'
                }`}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { onToggle(emoji); setPicking(false) }}
                    aria-label={`React with ${emoji}`}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base hover:bg-gray-50 transition-transform hover:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
