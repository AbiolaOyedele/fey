'use client'

import type { ReactionSummary } from '@/types/chat'

/**
 * The reaction strip under a message.
 *
 * Display only — reactions are added from the press-and-hold menu. An earlier
 * version put an "add reaction" button under every bubble, which meant a
 * permanent row of controls down the whole thread.
 *
 * Names are in the title attribute rather than always visible: a busy message
 * would otherwise turn into a wall of text, but "who reacted?" is still one
 * hover (or long-press) away.
 */

interface MessageReactionsProps {
  summaries: ReactionSummary[]
  accent: string
  /** Existing reactions stay clickable so you can remove your own. */
  canReact: boolean
  onToggle: (emoji: string) => void
  /** Mirrors the bubble's alignment so the strip sits under the right edge. */
  align?: 'start' | 'end'
}

export default function MessageReactions({
  summaries, accent, canReact, onToggle, align = 'start',
}: MessageReactionsProps) {
  // Nothing to show until someone actually reacts. Adding a reaction lives in
  // the press-and-hold menu, so there's no permanent "+" sitting under every
  // message cluttering the thread.
  if (summaries.length === 0) return null

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

    </div>
  )
}
