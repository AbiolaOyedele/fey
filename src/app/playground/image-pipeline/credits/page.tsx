'use client'

import { ArrowDownRight, ArrowUpRight, CalendarClock } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useImageCredits } from '@/hooks/useImageCredits'
import RequestCreditsForm from '@/components/features/image-pipeline/RequestCreditsForm'
import { fmtCredits, fmtDateTime } from '@/components/features/image-pipeline/format'
import type { LedgerReason } from '@/types/image-pipeline'

const REASON_LABEL: Record<LedgerReason, string> = {
  allocation: 'Allocation',
  manual_grant: 'Manual grant',
  request_approved: 'Request approved',
  preview_charge: 'Preview',
  final_charge: 'Final (2K)',
  flow_channel: 'Flow generation',
  adjustment: 'Adjustment',
}

/** Credits — balance, allocation, ledger history and the request form. */
export default function ImagePipelineCreditsPage() {
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const { balance, ledger, allocation, loading, error, submitRequest } = useImageCredits()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
      {/* Left: balance + ledger */}
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-2xs font-semibold uppercase tracking-widest text-gray-300">Balance</p>
          {loading ? (
            <div className="h-9 w-24 bg-gray-100 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-3xl font-semibold tabular-nums mt-0.5" style={{ color: accent }}>
              {fmtCredits(balance?.balance ?? 0)}<span className="text-sm font-normal text-gray-400"> credits</span>
            </p>
          )}
          {allocation && (
            <p className="inline-flex items-center gap-1.5 text-2xs text-gray-400 mt-2">
              <CalendarClock size={13} />
              {fmtCredits(allocation.amount)} credits {allocation.cadence} · next {fmtDateTime(allocation.next_grant_at)}
            </p>
          )}
        </div>

        <div>
          <h3 className="text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">History</h3>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-white border border-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : error ? (
            <p className="text-sm text-rose-500">{error}</p>
          ) : ledger.length === 0 ? (
            <p className="text-sm text-gray-400">No transactions yet.</p>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50">
              {ledger.map((entry) => {
                const credit = entry.delta > 0
                return (
                  <div key={entry.id} className="flex items-center gap-3 p-3">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={credit ? { backgroundColor: `${accent}1F`, color: accent } : { backgroundColor: '#F3F4F6', color: '#6B7280' }}
                    >
                      {credit ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-700">{REASON_LABEL[entry.reason]}</p>
                      <p className="text-3xs text-gray-400">{fmtDateTime(entry.created_at)}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: credit ? accent : '#4B5563' }}>
                      {credit ? '+' : ''}{fmtCredits(entry.delta)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: request form */}
      <RequestCreditsForm accent={accent} onSubmit={submitRequest} />
    </div>
  )
}
