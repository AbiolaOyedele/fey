'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '@/contexts/SettingsContext'
import type { Toast, ToastPosition } from '@/types'

/** Cards visible in the collapsed stack before the rest are hidden behind. */
const MAX_VISIBLE = 3
/** Vertical peek (px) of each card behind the front one when collapsed. */
const PEEK = 10
/** Scale removed per card of depth when collapsed. */
const SCALE_STEP = 0.05
/** Gap (px) between cards when the stack is expanded on hover. */
const GAP = 12
/** Fallback card height (px) used before a card has been measured. */
const FALLBACK_HEIGHT = 64

const POSITIONS: ToastPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const ANCHOR: Record<ToastPosition, string> = {
  'top-left': 'top-6 left-6',
  'top-center': 'top-6 left-1/2 -translate-x-1/2',
  'top-right': 'top-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-6 right-6',
}

export default function ToastContainer() {
  const { toasts, dismissToast, settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'

  return (
    <>
      {POSITIONS.map((position) => {
        const group = toasts.filter((t) => t.position === position)
        if (group.length === 0) return null
        return (
          <ToastStack
            key={position}
            position={position}
            toasts={group}
            accent={accent}
            onDismiss={dismissToast}
          />
        )
      })}
    </>
  )
}

interface ToastStackProps {
  position: ToastPosition
  toasts: Toast[]
  accent: string
  onDismiss: (id: number) => void
}

function ToastStack({ position, toasts, accent, onDismiss }: ToastStackProps) {
  const [expanded, setExpanded] = useState(false)
  const [heights, setHeights] = useState<Record<number, number>>({})

  const isTop = position.startsWith('top')
  // Newest card is the front of the stack.
  const ordered = [...toasts].reverse()
  // Cards grow downward from a top anchor, upward from a bottom anchor.
  const dir = isTop ? 1 : -1

  const setHeight = useCallback((id: number, h: number) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }))
  }, [])

  const heightOf = (id: number) => heights[id] ?? FALLBACK_HEIGHT

  // Offset of card `i` (0 = front) from the anchor edge, in px (always positive).
  const offsetAt = (i: number) => {
    if (expanded) {
      let sum = 0
      for (let j = 0; j < i; j++) sum += heightOf(ordered[j].id) + GAP
      return sum
    }
    return Math.min(i, MAX_VISIBLE) * PEEK
  }

  // The stack needs a real hoverable footprint so the expanded gaps stay hovered.
  const frontHeight = heightOf(ordered[0].id)
  const regionHeight = expanded
    ? ordered.reduce((sum, t) => sum + heightOf(t.id), 0) + GAP * (ordered.length - 1)
    : frontHeight + Math.min(ordered.length - 1, MAX_VISIBLE) * PEEK

  return (
    <motion.div
      className={`fixed z-50 ${ANCHOR[position]}`}
      onHoverStart={() => setExpanded(true)}
      onHoverEnd={() => setExpanded(false)}
      animate={{ height: regionHeight }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      style={{ width: 320, height: regionHeight }}
    >
      <AnimatePresence initial={false}>
        {ordered.map((toast, i) => {
          const hidden = !expanded && i >= MAX_VISIBLE
          return (
            <ToastCard
              key={toast.id}
              toast={toast}
              accent={accent}
              onDismiss={onDismiss}
              onMeasure={setHeight}
              anchor={isTop ? 'top' : 'bottom'}
              interactive={expanded || i === 0}
              y={dir * offsetAt(i)}
              scale={expanded ? 1 : 1 - Math.min(i, MAX_VISIBLE) * SCALE_STEP}
              opacity={hidden ? 0 : 1}
              zIndex={ordered.length - i}
            />
          )
        })}
      </AnimatePresence>
    </motion.div>
  )
}

interface ToastCardProps {
  toast: Toast
  accent: string
  onDismiss: (id: number) => void
  onMeasure: (id: number, height: number) => void
  anchor: 'top' | 'bottom'
  interactive: boolean
  y: number
  scale: number
  opacity: number
  zIndex: number
}

function ToastCard({
  toast,
  accent,
  onDismiss,
  onMeasure,
  anchor,
  interactive,
  y,
  scale,
  opacity,
  zIndex,
}: ToastCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const report = () => onMeasure(toast.id, el.offsetHeight)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [toast.id, onMeasure])

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: anchor === 'top' ? -16 : 16, scale: 0.96 }}
      animate={{ opacity, y, scale }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="absolute inset-x-0 flex items-start gap-3 text-white px-5 py-3 rounded-2xl shadow-lg"
      style={{
        [anchor]: 0,
        transformOrigin: anchor,
        backgroundColor: accent,
        zIndex,
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">{toast.message}</p>
        {toast.description && (
          <p className="text-xs text-white/70 mt-0.5 leading-snug">{toast.description}</p>
        )}
      </div>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick()
            onDismiss(toast.id)
          }}
          className="text-sm font-semibold px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white flex-shrink-0"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/60 hover:text-white transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}
