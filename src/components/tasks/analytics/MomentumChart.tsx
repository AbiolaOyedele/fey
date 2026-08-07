'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Activity } from 'lucide-react'
import InsightCard from './InsightCard'
import { buildSeries } from '@/utils/taskInsights'
import type { AnalyticsRange, DailyPoint } from '@/types/task-analytics'

interface MomentumChartProps {
  daily: DailyPoint[]
  from: string
  to: string
  range: AnalyticsRange
  completed: number
  created: number
}

const BUCKET_NOUN = { day: 'day', week: 'week', month: 'month' } as const

/** How often to print an axis label, so 30 of them still fit on a phone. */
const LABEL_EVERY = { day: 5, week: 2, month: 1 } as const

/**
 * Completed work over the range, with everything that was added behind it.
 *
 * Reading it is a drag, not a hunt for a 4px bar: moving a finger or the mouse
 * across the plot scrubs through the buckets and the caption above updates.
 * That keeps it usable on a phone, where a per-bar tooltip never is.
 */
export default function MomentumChart({ daily, from, to, range, completed, created }: MomentumChartProps) {
  const { bars, bucket } = useMemo(() => buildSeries(daily, from, to, range), [daily, from, to, range])
  const [active, setActive] = useState<number | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  const max = useMemo(
    () => Math.max(1, ...bars.map((b) => Math.max(b.created, b.completed))),
    [bars],
  )

  const pickAt = useCallback((clientX: number) => {
    const el = plotRef.current
    if (!el || bars.length === 0) return
    const rect = el.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    setActive(Math.min(bars.length - 1, Math.max(0, Math.floor(ratio * bars.length))))
  }, [bars.length])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (bars.length === 0) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setActive((cur) => {
        const next = (cur ?? bars.length - 1) + (e.key === 'ArrowRight' ? 1 : -1)
        return Math.min(bars.length - 1, Math.max(0, next))
      })
    }
    if (e.key === 'Escape') setActive(null)
  }, [bars.length])

  const shown = active !== null ? bars[active] : null

  return (
    <InsightCard
      title="Momentum"
      icon={<Activity size={14} className="text-gray-400" />}
      hint={`Completed each ${BUCKET_NOUN[bucket]}, against what came in`}
      action={
        <div className="flex items-center gap-3 text-3xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--accent, #ED64A6)' }} />
            Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gray-100" />
            Added
          </span>
        </div>
      }
    >
      {/* Reading line — the whole-range summary until a bucket is picked. */}
      <div className="mb-3 min-h-[36px]">
        {shown ? (
          <>
            <p className="text-xs2 font-medium text-gray-800">{shown.title}</p>
            <p className="text-2xs text-gray-400 tabular-nums">
              {shown.completed} completed · {shown.created} added
            </p>
          </>
        ) : (
          <>
            <p className="text-xs2 font-medium text-gray-800 tabular-nums">
              {completed} completed
            </p>
            <p className="text-2xs text-gray-400 tabular-nums">{created} added over the same period</p>
          </>
        )}
      </div>

      {bars.length === 0 ? (
        <p className="text-xs text-gray-400 py-10 text-center">Nothing to chart for this period yet.</p>
      ) : (
        <>
          <div
            ref={plotRef}
            role="img"
            tabIndex={0}
            aria-label={`Task momentum: ${completed} completed and ${created} added across ${bars.length} ${BUCKET_NOUN[bucket]}s. Use the arrow keys to read each ${BUCKET_NOUN[bucket]}.`}
            className="relative h-36 sm:h-44 flex items-end gap-px touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
            onPointerDown={(e) => pickAt(e.clientX)}
            onPointerMove={(e) => { if (e.pointerType !== 'touch' || e.buttons > 0) pickAt(e.clientX) }}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
          >
            {/* Faint halfway line, so bar heights can be read without an axis. */}
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-100 pointer-events-none" />
            {bars.map((bar, i) => (
              <div key={bar.key} className="relative flex-1 min-w-0 h-full pointer-events-none">
                {i === active && <div className="absolute inset-0 bg-gray-50 rounded-md" />}
                <div
                  className="absolute bottom-0 inset-x-0 bg-gray-100 rounded-t-[3px]"
                  style={{ height: `${(bar.created / max) * 100}%`, minHeight: bar.created > 0 ? 3 : 0 }}
                />
                <div
                  className="absolute bottom-0 left-[22%] right-[22%] rounded-t-[3px] transition-opacity"
                  style={{
                    height: `${(bar.completed / max) * 100}%`,
                    minHeight: bar.completed > 0 ? 3 : 0,
                    backgroundColor: 'var(--accent, #ED64A6)',
                    opacity: active === null || i === active ? 1 : 0.55,
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-px mt-2" aria-hidden="true">
            {bars.map((bar, i) => (
              <span key={bar.key} className="flex-1 min-w-0 text-center text-4xs text-gray-300 tabular-nums">
                {i % LABEL_EVERY[bucket] === 0 ? bar.label : ''}
              </span>
            ))}
          </div>
        </>
      )}
    </InsightCard>
  )
}
