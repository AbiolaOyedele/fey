'use client'

import { CheckCircle2, Target, CalendarCheck, Timer } from 'lucide-react'
import { Delta, DeltaIcon, DeltaValue } from '@/components/delta'
import { formatDuration, formatPercent, percentChange } from '@/utils/taskInsights'
import type { AnalyticsRange, PreviousTotals, RangeTotals } from '@/types/task-analytics'

interface StatTilesProps {
  totals: RangeTotals
  previous: PreviousTotals
  range: AnalyticsRange
}

const RANGE_WORD: Record<AnalyticsRange, string> = {
  '30d': 'the last 30 days',
  '90d': 'the last 90 days',
  '12m': 'the last year',
}

interface Tile {
  label: string
  value: string
  hint: string
  icon: typeof CheckCircle2
  /**
   * Movement against the previous period. `value` carries the direction, so
   * turnaround passes its change negated — finishing work faster is good news
   * even though the number went down.
   */
  change: { value: number; suffix: string } | null
}

/** Percentage-point move, for the rates. Null when either side has no data. */
function pointChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return (current - previous) * 100
}

/**
 * The four headline numbers. Each one answers a different question: how much
 * got done, how much of what came in got finished, whether it landed on time,
 * and how long it took.
 */
export default function StatTiles({ totals, previous, range }: StatTilesProps) {
  const word = RANGE_WORD[range]

  const completedChange = percentChange(totals.completed, previous.completed)
  const onTimeChange = pointChange(totals.onTimeRate, previous.onTimeRate)
  const turnaroundChange = totals.medianCycleHours !== null && previous.medianCycleHours
    ? percentChange(totals.medianCycleHours, previous.medianCycleHours)
    : null

  const tiles: Tile[] = [
    {
      label: 'Tasks completed',
      value: String(totals.completed),
      hint: `${totals.created} added in ${word}`,
      icon: CheckCircle2,
      change: completedChange === null ? null : { value: completedChange, suffix: '%' },
    },
    {
      label: 'Completion rate',
      value: formatPercent(totals.completionRate),
      hint: 'of new tasks, now done',
      icon: Target,
      change: null,
    },
    {
      label: 'Finished on time',
      value: formatPercent(totals.onTimeRate),
      hint: 'of those with a due date',
      icon: CalendarCheck,
      change: onTimeChange === null ? null : { value: onTimeChange, suffix: ' pts' },
    },
    {
      label: 'Typical turnaround',
      value: formatDuration(totals.medianCycleHours),
      hint: 'from added to done',
      icon: Timer,
      // Faster is better, so the direction is inverted against the raw change.
      change: turnaroundChange === null ? null : { value: -turnaroundChange, suffix: '%' },
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((t) => {
        const Icon = t.icon
        return (
          <div key={t.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Icon size={15} className="text-gray-400" />
              {t.change && (
                <Delta value={t.change.value} className="text-3xs">
                  <DeltaIcon variant="trend" />
                  <DeltaValue precision={0} suffix={t.change.suffix} />
                </Delta>
              )}
            </div>
            <p className="text-2xs text-gray-400 mb-1">{t.label}</p>
            <p className="font-display text-3xl font-normal text-gray-900 tabular-nums leading-none">{t.value}</p>
            <p className="text-3xs text-gray-400 mt-1.5 truncate">{t.hint}</p>
          </div>
        )
      })}
    </div>
  )
}
