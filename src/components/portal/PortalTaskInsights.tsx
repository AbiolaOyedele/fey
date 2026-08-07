'use client'

import { useState } from 'react'
import { BarChart3, Loader2 } from 'lucide-react'
import { usePortalTaskAnalytics } from '@/hooks/usePortalTaskAnalytics'
import { Skeleton } from '@/components/ui/skeleton'
import StatTiles from '@/components/tasks/analytics/StatTiles'
import MomentumChart from '@/components/tasks/analytics/MomentumChart'
import Breakdown from '@/components/tasks/analytics/Breakdown'
import OpenWork from '@/components/tasks/analytics/OpenWork'
import type { AnalyticsRange } from '@/types/task-analytics'

interface PortalTaskInsightsProps {
  subdomain: string
}

const RANGES: Array<{ key: AnalyticsRange; label: string }> = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
]

/**
 * Progress, as the client sees it — the same panels the agency's Insights tab
 * uses, minus the parts that are none of a client's business.
 *
 * What's deliberately absent: per-teammate figures (the API returns none), a
 * per-client split (there is only one client here), the year-long activity map
 * (internal rhythm, not a client update), and drill-down — a client reads these
 * numbers, they don't interrogate them.
 */
export default function PortalTaskInsights({ subdomain }: PortalTaskInsightsProps) {
  const [range, setRange] = useState<AnalyticsRange>('30d')
  const { data, loading, refreshing, error, unavailable, refetch } = usePortalTaskAnalytics(subdomain, range)

  // The tab that renders this hides itself when Progress is switched off, so
  // this is only reachable if it was turned off mid-session.
  if (unavailable) return null

  const hasAnything = !!data && (
    data.totals.open > 0 || data.totals.created > 0 || data.daily.some((d) => d.completed > 0)
  )

  return (
    <div className="space-y-4">
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
        {refreshing && <Loader2 size={14} className="animate-spin text-gray-300" aria-label="Updating" />}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-16 text-center px-6">
          <p className="text-sm text-gray-500 mb-3">{error}</p>
          <button onClick={refetch} className="text-sm font-semibold min-h-11" style={{ color: 'var(--accent-text, currentColor)' }}>
            Try again
          </button>
        </div>
      ) : !data || !hasAnything ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-16 text-center px-6">
          <BarChart3 size={30} strokeWidth={1.5} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">Nothing to report yet</p>
          <p className="text-xs2 text-gray-400 mt-0.5 max-w-xs">
            Once work starts moving, your progress will show up here.
          </p>
        </div>
      ) : (
        <>
          <StatTiles
            totals={data.totals}
            previous={data.previous}
            range={data.range}
            tiles={['completed', 'onTime', 'turnaround']}
          />

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
                dimensions={['brand', 'priority']}
              />
            </div>
            <div className="lg:col-span-2">
              <OpenWork due={data.due} open={data.totals.open} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
