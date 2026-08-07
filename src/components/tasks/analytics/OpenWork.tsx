'use client'

import { useMemo, useState } from 'react'
import { Inbox } from 'lucide-react'
import InsightCard from './InsightCard'
import type { DueBuckets } from '@/types/task-analytics'

interface OpenWorkProps {
  due: DueBuckets
  open: number
}

interface Slice {
  key: keyof DueBuckets
  label: string
  hint: string
  color: string
  value: number
}

/**
 * The whole ring is 100 units, so a slice's length is its percentage — the
 * circumference trick that keeps the arc maths to one subtraction.
 */
const RADIUS = 15.915494

/**
 * What's still on the plate, split by how urgent it is.
 *
 * Deliberately the one panel that ignores the range: a backlog doesn't reset
 * because you changed the window you're looking through.
 */
export default function OpenWork({ due, open }: OpenWorkProps) {
  const [active, setActive] = useState<keyof DueBuckets | null>(null)

  const slices = useMemo<Slice[]>(() => ([
    { key: 'overdue', label: 'Overdue',   hint: 'past their due date', color: '#FC8181', value: due.overdue },
    { key: 'today',   label: 'Due today', hint: 'landing today',       color: '#F6AD55', value: due.today },
    { key: 'week',    label: 'This week', hint: 'in the next 7 days',  color: 'var(--accent, #ED64A6)', value: due.week },
    { key: 'later',   label: 'Later',     hint: 'further out',         color: '#CBD5E1', value: due.later },
    { key: 'none',    label: 'No date',   hint: 'no due date set',     color: '#E5E7EB', value: due.none },
  ]), [due])

  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const shown = active ? slices.find((s) => s.key === active) ?? null : null

  // Each arc starts where the last one ended, walking clockwise from the top.
  let cursor = 0
  const arcs = slices.filter((s) => s.value > 0).map((s) => {
    const length = (s.value / Math.max(1, total)) * 100
    const arc = { ...s, length, offset: -cursor }
    cursor += length
    return arc
  })

  return (
    <InsightCard
      title="Open work"
      icon={<Inbox size={14} className="text-gray-400" />}
      hint="Where the backlog stands right now"
    >
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Inbox size={26} className="text-gray-200 mb-3" />
          <p className="text-xs text-gray-400">Nothing open — the board is clear.</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative flex-shrink-0" onPointerLeave={() => setActive(null)}>
            <svg viewBox="0 0 42 42" className="w-32 h-32" role="img" aria-label={`${open} open tasks: ${slices.filter((s) => s.value > 0).map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}.`}>
              <circle cx="21" cy="21" r={RADIUS} fill="none" stroke="#F3F4F6" strokeWidth="5" />
              {arcs.map((arc) => (
                <circle
                  key={arc.key}
                  cx="21"
                  cy="21"
                  r={RADIUS}
                  fill="none"
                  strokeWidth={active === arc.key ? 6 : 5}
                  strokeDasharray={`${Math.max(0, arc.length - 0.6)} ${100 - Math.max(0, arc.length - 0.6)}`}
                  strokeDashoffset={arc.offset}
                  transform="rotate(-90 21 21)"
                  className="transition-[stroke-width,opacity] duration-150"
                  // Set through style, not the attribute: a CSS variable only
                  // resolves in a CSS property value.
                  style={{ stroke: arc.color, opacity: active === null || active === arc.key ? 1 : 0.35 }}
                  onPointerEnter={() => setActive(arc.key)}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-display text-2xl font-normal text-gray-900 tabular-nums leading-none">
                {shown ? shown.value : open}
              </span>
              <span className="text-3xs text-gray-400 mt-1">{shown ? shown.label.toLowerCase() : 'open'}</span>
            </div>
          </div>

          <ul className="w-full sm:flex-1 min-w-0 space-y-0.5">
            {slices.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onPointerEnter={() => setActive(s.key)}
                  onPointerLeave={() => setActive(null)}
                  onClick={() => setActive((cur) => (cur === s.key ? null : s.key))}
                  disabled={s.value === 0}
                  className={`w-full min-h-11 flex items-center gap-2.5 px-2 -mx-2 rounded-lg text-left transition-colors ${
                    s.value === 0 ? 'opacity-40' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs2 font-medium text-gray-700 truncate">{s.label}</span>
                    <span className="block text-3xs text-gray-400 truncate">{s.hint}</span>
                  </span>
                  <span className="text-xs2 font-medium text-gray-800 tabular-nums flex-shrink-0">{s.value}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </InsightCard>
  )
}
