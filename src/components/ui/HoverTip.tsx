'use client'

import { useState, useRef, useCallback } from 'react'

interface HoverTipProps {
  /** Text to show. If empty, children render with no tooltip. */
  label: string | null | undefined
  children: React.ReactNode
  /** ms to wait before showing on hover. */
  delay?: number
  side?: 'top' | 'bottom'
  className?: string
}

/**
 * Lightweight, dependency-free hover tooltip — shows `label` after a short delay.
 * Wrap any element: <HoverTip label="Due today">…</HoverTip>. (The shadcn
 * Tooltip primitive in ./Tooltip is heavier; this is for quick inline hints.)
 */
export default function HoverTip({ label, children, delay = 500, side = 'top', className = '' }: HoverTipProps) {
  const [show, setShow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onEnter = useCallback(() => {
    if (!label) return
    timer.current = setTimeout(() => setShow(true), delay)
  }, [label, delay])

  const onLeave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setShow(false)
  }, [])

  if (!label) return <>{children}</>

  return (
    <span className={`relative inline-flex ${className}`} onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave}>
      {children}
      {show && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-[60] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-2xs font-medium text-white shadow-lg ${
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {label}
        </span>
      )}
    </span>
  )
}
