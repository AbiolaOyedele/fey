'use client'

import { useMemo, useState } from 'react'
import { Loader2, X, BarChart3 } from 'lucide-react'
import { useTaskAnalytics } from '@/hooks/useTaskAnalytics'
import { Skeleton } from '@/components/ui/skeleton'
import StatTiles from './StatTiles'
import MomentumChart from './MomentumChart'
import Breakdown from './Breakdown'
import OpenWork from './OpenWork'
import ActivityMap from './ActivityMap'
import type { AnalyticsFilter, AnalyticsRange } from '@/types/task-analytics'

interface InsightsPanelProps {
  workspaceId: string | null | undefined
  accent: string
}

const RANGES: Array<{ key: AnalyticsRange; label: string }> = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
]

const FILTER_NOUN: Record<AnalyticsFilter['kind'], string> = {
  brand: 'Brand',
  client: 'Client',
  person: 'Assigned to',
}

/**
 * Tasks → Insights. Reads the same work_tasks the board does and answers the
 * questions a list can't: how much is actually getting finished, for whom, and
 * whether it's landing on time.
 *
 * Range and drill-down both live here so every panel below moves together —
 * pick a brand in the breakdown and the tiles, momentum and activity map all
 * re-read for that brand alone.
 */
export default function InsightsPanel({ workspaceId, accent }: InsightsPanelProps) {
  const [range, setRange] = useState<AnalyticsRange>('30d')
  const [filter, setFilter] = useState<AnalyticsFilter | null>(null)

  const { data, loading, refreshing, error, refetch } = useTaskAnalytics({ workspaceId, range, filter })

  const hasAnything = useMemo(() => {
    if (!data) return false
    return data.totals.open > 0
      || data.totals.created > 0
      || data.daily.some((d) => d.completed > 0)
  }, [data])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`px-3 min-h-9 rounded-md text-xs2 font-medium transition-colors ${
                range === r.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {filter && (
          <button
            onClick={() => setFilter(null)}
            className="flex items-center gap-1.5 min-h-9 pl-3 pr-2 rounded-full text-xs2 font-medium max-w-full"
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text, #ED64A6)' }}
          >
            <span className="truncate">{FILTER_NOUN[filter.kind]} · {filter.label}</span>
            <X size={14} className="flex-shrink-0" />
            <span className="sr-only">Clear filter</span>
          </button>
        )}

        {refreshing && <Loader2 size={14} className="animate-spin text-gray-300" aria-label="Updating" />}
      </div>

      {loading ? (
        <InsightsSkeleton />
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-16 text-center px-6">
          <p className="text-sm text-gray-500 mb-3">{error}</p>
          <button onClick={refetch} className="text-sm font-semibold min-h-11" style={{ color: 'var(--accent-text, #ED64A6)' }}>
            Try again
          </button>
        </div>
      ) : !data || !hasAnything ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-16 text-center px-6">
          <BarChart3 size={30} strokeWidth={1.5} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">No task activity yet</p>
          <p className="text-xs2 text-gray-400 mt-0.5 max-w-xs">
            {filter
              ? 'Nothing to show for this filter — clear it to see everything.'
              : 'Add and complete a few tasks and your insights will build up here.'}
          </p>
        </div>
      ) : (
        <>
          <StatTiles totals={data.totals} previous={data.previous} range={data.range} />

          <MomentumChart
            daily={data.daily}
            from={data.from}
            to={data.to}
            range={data.range}
            completed={data.totals.completed}
            created={data.totals.created}
          />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <Breakdown
                brands={data.brands}
                clients={data.clients}
                people={data.people}
                priorities={data.priorities}
                filter={filter}
                onFilter={setFilter}
              />
            </div>
            <div className="lg:col-span-2">
              <OpenWork due={data.due} open={data.totals.open} />
            </div>
          </div>

          <ActivityMap daily={data.daily} totals={data.totals} accent={accent} />
        </>
      )}
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <Skeleton className="h-4 w-4 rounded mb-3" />
            <Skeleton className="h-2.5 w-20 mb-2" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
        <Skeleton className="h-3 w-28 mb-5" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-3">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
          <Skeleton className="h-3 w-24 mb-5" />
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
        </div>
      </div>
    </div>
  )
}
