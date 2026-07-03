'use client'

import * as React from 'react'
import { motion, useReducedMotion, type Transition } from 'framer-motion'

/** Hand-drawn scribble path, drawn left-to-right across the label. */
const SCRIBBLE_PATH =
  'M 10 16.91 s 79.8 -11.36 98.1 -11.34 c 22.2 0.02 -47.82 14.25 -33.39 22.02 c 12.61 6.77 124.18 -27.98 133.31 -17.28 c 7.52 8.38 -26.8 20.02 4.61 22.05 c 24.55 1.93 113.37 -20.36 113.37 -20.36'

interface ScribbleStrikeProps {
  /** Whether the item is completed — drives the scribble in/out. */
  done: boolean
  children: React.ReactNode
  /** Extra classes for the wrapper span (e.g. truncate, min-w-0). */
  className?: string
}

/**
 * Wraps a task/subtask label and draws an animated hand-drawn scribble
 * across it when `done` is true, replacing the static `line-through`.
 * Falls back to an instant strike when the user prefers reduced motion.
 */
export default function ScribbleStrike({ done, children, className = '' }: ScribbleStrikeProps) {
  const reducedMotion = useReducedMotion()

  const transition: Transition = reducedMotion
    ? { pathLength: { duration: 0 }, opacity: { duration: 0 } }
    : {
        pathLength: { duration: 0.6, ease: 'easeInOut' },
        opacity: { duration: 0.01, delay: done ? 0 : 0.6 },
      }

  return (
    <span className={`relative inline-block max-w-full align-bottom ${className}`}>
      {children}
      <motion.svg
        viewBox="0 0 340 32"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none z-10 w-full h-8"
      >
        <motion.path
          d={SCRIBBLE_PATH}
          vectorEffect="non-scaling-stroke"
          strokeWidth={2}
          strokeLinecap="round"
          strokeMiterlimit={10}
          fill="none"
          initial={false}
          animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
          transition={transition}
          className="stroke-gray-400"
        />
      </motion.svg>
    </span>
  )
}
