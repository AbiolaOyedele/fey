'use client'

import { useEffect, useRef, useState } from 'react'
import { CornerUpLeft, Pencil, Trash2, EyeOff, Copy, Check } from 'lucide-react'
import { QUICK_REACTIONS } from '@/types/chat'

/**
 * The message action menu — right-click on desktop, long-press on touch.
 *
 * Replaces the hover toolbar that used to float beside every bubble. That was
 * wrong twice over: it was pinned to the row rather than the bubble, so on a
 * right-aligned message the controls appeared at the far left of the screen,
 * and being permanently rendered it cluttered every message in the thread.
 * WhatsApp puts all of this behind a press, and so does this.
 *
 * Positioned at the pointer and clamped to the viewport, so it opens next to
 * whatever was pressed no matter which side the bubble sits on.
 */

export interface MessageAction {
  key: string
  label: string
  icon: 'reply' | 'edit' | 'delete' | 'hide' | 'copy'
  /** Renders in red — reserved for unsending for everyone. */
  destructive?: boolean
  onSelect: () => void
}

const ICONS = {
  reply:  CornerUpLeft,
  edit:   Pencil,
  delete: Trash2,
  hide:   EyeOff,
  copy:   Copy,
} as const

interface MessageContextMenuProps {
  x: number
  y: number
  actions: MessageAction[]
  /** Omit to hide the reaction row (e.g. on a deleted message). */
  onReact?: ((emoji: string) => void) | undefined
  /** Which emoji the viewer has already picked, so it reads as selected. */
  activeReaction?: string | undefined
  onClose: () => void
}

const MENU_WIDTH = 200

export default function MessageContextMenu({
  x, y, actions, onReact, activeReaction, onClose,
}: MessageContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  // Measure after mount and flip the menu up/left when it would overflow —
  // a menu opened near the bottom of a thread must not run off screen.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top:  Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    // A menu anchored to a point has to close when the thread moves under it.
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.left, top: pos.top, minWidth: MENU_WIDTH }}
      className="fixed z-[60] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
    >
      {onReact && (
        <div className="flex items-center gap-0.5 px-1.5 py-1.5 border-b border-gray-50">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onReact(emoji); onClose() }}
              aria-label={`React with ${emoji}`}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-transform hover:scale-125 ${
                activeReaction === emoji ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {actions.map((a) => {
        const Icon = a.icon === 'copy' && a.key === 'copied' ? Check : ICONS[a.icon]
        return (
          <button
            key={a.key}
            role="menuitem"
            onClick={() => { a.onSelect(); onClose() }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[42px] text-sm text-left transition-colors ${
              a.destructive ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon size={14} className="flex-shrink-0" />
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Wires right-click and long-press to one open-at-a-point handler.
 *
 * Long-press is 450ms and cancels on a 10px drag, so scrolling a thread never
 * fires it by accident — the single most common way a press-and-hold menu
 * becomes infuriating on a phone.
 */
export function useMessageMenu() {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const open = (id: string, x: number, y: number) => setMenu({ id, x, y })
  const close = () => setMenu(null)

  const onContextMenu = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    open(id, e.clientX, e.clientY)
  }

  const onTouchStart = (id: string) => (e: React.TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    start.current = { x: t.clientX, y: t.clientY }
    timer.current = setTimeout(() => open(id, t.clientX, t.clientY), 450)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0]
    if (!t || !start.current || !timer.current) return
    const moved = Math.abs(t.clientX - start.current.x) + Math.abs(t.clientY - start.current.y)
    if (moved > 10) { clearTimeout(timer.current); timer.current = null }
  }

  const onTouchEnd = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }

  return { menu, close, onContextMenu, onTouchStart, onTouchMove, onTouchEnd }
}
