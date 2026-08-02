'use client'

import { X, CornerUpLeft } from 'lucide-react'
import { replyPreview } from '@/types/chat'

/**
 * The quoted-message strip.
 *
 * Two placements, one component:
 *   • above the composer while you're writing a reply (dismissible)
 *   • inside the bubble once it's sent (clickable, jumps to the original)
 *
 * A reply whose parent was deleted still renders — showing the tombstone text
 * rather than dropping the quote, because "replying to something that's gone"
 * is information, and silently un-quoting it makes the thread read wrong.
 */

interface ReplyPreviewProps {
  senderName: string
  body: string | null
  deleted?: boolean
  accent: string
  /** Composer mode: shows a dismiss button. */
  onCancel?: () => void
  /** Bubble mode: jumps to the quoted message. */
  onJump?: () => void
  /** Inverts colours for use inside an accent-filled bubble. */
  onAccent?: boolean
}

export default function ReplyPreview({
  senderName, body, deleted, accent, onCancel, onJump, onAccent,
}: ReplyPreviewProps) {
  const text = replyPreview(body, deleted)

  // Inside a filled bubble the accent bar would be invisible against the
  // background, so the whole strip flips to translucent white.
  const barColor = onAccent ? 'rgba(255,255,255,0.7)' : accent
  const bg = onAccent ? 'rgba(255,255,255,0.14)' : '#F8F8F8'
  const nameColor = onAccent ? 'rgba(255,255,255,0.95)' : accent
  const textColor = onAccent ? 'rgba(255,255,255,0.8)' : '#9CA3AF'

  const inner = (
    <>
      <span aria-hidden className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: barColor }} />
      <span className="min-w-0 flex-1">
        <span className="block text-2xs font-semibold truncate" style={{ color: nameColor }}>
          {senderName}
        </span>
        <span className={`block text-2xs truncate ${deleted ? 'italic' : ''}`} style={{ color: textColor }}>
          {text}
        </span>
      </span>
    </>
  )

  if (onCancel) {
    return (
      <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2" style={{ backgroundColor: bg }}>
        <CornerUpLeft size={13} className="text-gray-300 flex-shrink-0" />
        {inner}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel reply"
          className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-300 hover:text-gray-500 flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onJump}
      className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1 text-left transition-opacity hover:opacity-80"
      style={{ backgroundColor: bg }}
    >
      {inner}
    </button>
  )
}
