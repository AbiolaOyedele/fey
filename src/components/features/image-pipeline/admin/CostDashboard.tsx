'use client'

import type { AdminCostDashboardResponse } from '@/types/image-pipeline'
import { creditsLabel, fmtCredits, fmtUsd } from '../format'

interface CostDashboardProps {
  dashboard: AdminCostDashboardResponse
  period: 'week' | 'month'
  onPeriod: (p: 'week' | 'month') => void
  accent: string
}

/** Per-user usage, estimated actual spend, and budgeted spend from live rates. */
export default function CostDashboard({ dashboard, period, onPeriod, accent }: CostDashboardProps) {
  return (
    <div>
      {/* Period toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex rounded-lg border border-gray-100 bg-gray-50 p-0.5">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriod(p)}
              className={`px-3 h-8 rounded-md text-2xs font-medium capitalize transition-colors ${
                period === p ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <TotalCard label="Credits used" value={fmtCredits(dashboard.totals.credits_used)} accent={accent} />
        <TotalCard label="Est. spend" value={fmtUsd(dashboard.totals.estimated_spend_usd)} />
        <TotalCard label="Budgeted" value={fmtUsd(dashboard.totals.budgeted_spend_usd)} />
      </div>

      {/* Per-user rows */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <div className="hidden sm:grid grid-cols-4 gap-2 px-4 py-2 bg-gray-50 text-3xs font-semibold uppercase tracking-wide text-gray-400">
          <span>User</span>
          <span className="text-right">Credits</span>
          <span className="text-right">Est. spend</span>
          <span className="text-right">Budget</span>
        </div>
        <div className="divide-y divide-gray-50">
          {dashboard.usage.map((row) => (
            <div key={row.user_id} className="grid grid-cols-[1fr_auto] sm:grid-cols-4 gap-2 px-4 py-3 items-center">
              <div className="min-w-0">
                <p className="text-sm text-gray-700 truncate">{row.display_name}</p>
                <p className="text-3xs text-gray-400 truncate sm:hidden">{creditsLabel(row.credits_used)} · {fmtUsd(row.estimated_spend_usd)} spent</p>
              </div>
              <span className="hidden sm:block text-sm text-gray-600 text-right tabular-nums">{fmtCredits(row.credits_used)}</span>
              <span className="hidden sm:block text-sm text-gray-600 text-right tabular-nums">{fmtUsd(row.estimated_spend_usd)}</span>
              <div className="text-right">
                <span className="block text-3xs text-gray-300 sm:hidden">budget</span>
                <span className="text-sm text-gray-400 tabular-nums">{fmtUsd(row.budgeted_spend_usd)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-3xs text-gray-300 mt-2">
        Estimated spend = usage × live rates. Budget = allocation × anchor cost per credit.
      </p>
    </div>
  )
}

function TotalCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <p className="text-3xs font-semibold uppercase tracking-wide text-gray-300">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-0.5" style={accent ? { color: accent } : { color: '#374151' }}>{value}</p>
    </div>
  )
}
