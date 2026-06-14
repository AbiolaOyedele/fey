'use client'

import { useState, useRef, useEffect } from 'react'
import { Smile } from 'lucide-react'

// A compact, dependency-free set covering the everyday range.
const EMOJIS = [
  '😀','😄','😁','😅','😂','🙂','😉','😊','😍','😘','😎','🤩','🤔','🤗','🙃','😴',
  '👍','👎','👏','🙌','🙏','💪','🤝','👌','✌️','🤞','👋','💯','🔥','✨','⭐','🎉',
  '❤️','🧡','💛','💚','💙','💜','🖤','💔','😢','😭','😡','😤','😬','😱','🤯','🥳',
  '✅','❌','⚠️','📌','📎','📁','📷','💬','📈','💰','⏰','🚀','💡','🎯','👀','🙇',
]

interface EmojiPickerProps {
  onPick: (emoji: string) => void
  /** Optional className for the trigger button. */
  className?: string
}

/** A small popover emoji picker. Opens above the trigger to suit composers. */
export default function EmojiPicker({ onPick, className = '' }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Emoji"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ${className}`}
      >
        <Smile size={16} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 bg-white rounded-2xl border border-gray-100 shadow-lg p-2 w-[268px] animate-fadeIn">
          <div className="grid grid-cols-8 gap-0.5 max-h-[180px] overflow-y-auto">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { onPick(e); setOpen(false) }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-lg leading-none transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
