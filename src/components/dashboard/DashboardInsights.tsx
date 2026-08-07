'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { BarChart3, ArrowUpRight } from 'lucide-react'
import { useTaskAnalytics } from '@/hooks/useTaskAnalytics'
import { Skeleton } from '@/components/ui/skeleton'
import { Delta, DeltaIcon, DeltaValue } from '@/components/delta'
import { formatDuration, formatLongDay, formatPercent, percentChange } from '@/utils/taskInsights'

interface DashboardInsightsProps {
  workspaceId: string | null | undefined
}

/** Days of history in the mini strip — two weeks reads as "lately" without crowding. */
const STRIP_DAYS = 14

/**
 * The dashboard's read on how tasks are actually going: the three numbers worth
 * glancing at, a fortnight of completions, and which brands they belonged to.
 * The full picture lives one tap away in Tasks → Insights.
 */
export default function DashboardInsights({ workspaceId }: DashboardInsightsProps) {
  const { data, loading, error } = useTaskAnalytics({ workspaceId, range: '30d' })

  const strip = useMemo(() => (data ? data.daily.slice(-STRIP_DAYS) : []), [data])
  const stripMax = useMemo(() => Math.max(1, ...strip.map((d) => d.completed)), [strip])
  const topBrands = useMemo(
    () => (data ? data.brands.filter((b) => b.completed > 0).slice(0, 3) : []),
    [data],
  )
  const brandMax = useMemo(() => Math.max(1, ...topBrands.map((b) => b.completed)), [topBrands])

  const completedChange = data ? percentChange(data.totals.completed, data.previous.completed) : null
  const hasActivity = !!data && (data.totals.completed > 0 || data.totals.created > 0 || data.totals.open > 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 size={14} className="text-gray-400" />
          <p className="text-sm font-semibold text-gray-800 truncate">Task insights</p>
          <span className="text-3xs text-gray-400 flex-shrink-0 hidden sm:inline">last 30 days</span>
        </div>
        <Link
          href="/tasks?view=insights"
          className="text-xs font-medium transition-colors hover:opacity-80 flex items-center gap-0.5 flex-shrink-0"
          style={{ color: 'var(--accent-text, currentColor)' }}
        >
          View insights <ArrowUpRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2"><Skeleton className="h-2.5 w-16" /><Skeleton className="h-6 w-12" /></div>
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : error ? (
        <p className="text-xs text-gray-400 py-6 text-center">{error}</p>
      ) : !hasActivity ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3 size={26} className="text-gray-200 mb-3" />
          <p className="text-xs text-gray-400">Complete a few tasks and your insights will build up here</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Headline numbers */}
          <div className="grid grid-cols-3 gap-3">
            <div className="min-w-0">
              <p className="text-2xs text-gray-400 mb-1 truncate">Completed</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-display text-2xl font-normal text-gray-900 tabular-nums leading-none">
                  {data!.totals.completed}
                </span>
                {completedChange !== null && (
                  <Delta value={completedChange} className="text-3xs">
                    <DeltaIcon variant="trend" />
                    <DeltaValue precision={0} />
                  </Delta>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-2xs text-gray-400 mb-1 truncate">On time</p>
              <span className="font-display text-2xl font-normal text-gray-900 tabular-nums leading-none">
                {formatPercent(data!.totals.onTimeRate)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-2xs text-gray-400 mb-1 truncate">Turnaround</p>
              <span className="font-display text-2xl font-normal text-gray-900 tabular-nums leading-none">
                {formatDuration(data!.totals.medianCycleHours)}
              </span>
            </div>
          </div>

          {/* A fortnight of completions */}
          <div>
            <div className="flex items-end gap-1 h-12" role="img" aria-label={`Tasks completed on each of the last ${STRIP_DAYS} days.`}>
              {strip.map((day) => (
                <span
                  key={day.date}
                  title={`${day.completed} completed · ${formatLongDay(day.date)}`}
                  className="flex-1 min-w-0 rounded-t-[3px] bg-gray-100 relative"
                  style={{ height: '100%' }}
                >
                  <span
                    className="absolute bottom-0 inset-x-0 rounded-t-[3px]"
                    style={{
                      height: `${(day.completed / stripMax) * 100}%`,
                      minHeight: day.completed > 0 ? 3 : 0,
                      backgroundColor: 'var(--accent, #ED64A6)',
                    }}
                  />
                </span>
              ))}
            </div>
            <p className="text-3xs text-gray-400 mt-1.5">Last {STRIP_DAYS} days</p>
          </div>

          {/* Where it landed */}
          {topBrands.length > 0 && (
            <div className="space-y-2">
              <p className="text-3xs text-gray-400">Most completed by brand</p>
              {topBrands.map((b) => (
                <div key={b.id || 'none'} className="flex items-center gap-3">
                  <span className="text-xs2 text-gray-700 truncate w-24 sm:w-32 flex-shrink-0">{b.label}</span>
                  <span className="flex-1 min-w-0 h-1.5 rounded-full bg-gray-50 overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(b.completed / brandMax) * 100}%`, backgroundColor: 'var(--accent, #ED64A6)' }}
                    />
                  </span>
                  <span className="text-xs2 text-gray-500 tabular-nums flex-shrink-0 w-6 text-right">{b.completed}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
