'use client'

import { Check, X } from 'lucide-react'
import type { IpCreditRequest } from '@/types/image-pipeline'
import { fmtCredits, fmtDateTime } from '../format'

interface CreditRequestQueueProps {
  requests: IpCreditRequest[]
  accent: string
  onResolve: (requestId: string, decision: 'approved' | 'denied') => Promise<void>
  nameOf: (userId: string) => string
}

/** Pending credit requests with approve/deny; resolved ones shown for history. */
export default function CreditRequestQueue({ requests, accent, onResolve, nameOf }: CreditRequestQueueProps) {
  const pending = requests.filter((r) => r.status === 'pending')
  const resolved = requests.filter((r) => r.status !== 'pending')

  if (requests.length === 0) {
    return <p className="text-sm text-gray-400">No credit requests yet.</p>
  }

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <p className="text-sm text-gray-400">No pending requests.</p>
      ) : (
        <div className="space-y-2">
          {pending.map((r) => (
            <div key={r.id} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {nameOf(r.user_id)} · <span style={{ color: accent }}>{fmtCredits(r.amount)} credits</span>
                  </p>
                  {r.note && <p className="text-xs text-gray-500 mt-1">{r.note}</p>}
                  <p className="text-3xs text-gray-400 mt-1">{fmtDateTime(r.created_at)}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    type="button" onClick={() => onResolve(r.id, 'approved')}
                    className="inline-flex items-center gap-1 rounded-lg px-3 h-10 text-2xs font-medium text-white transition-all active:scale-95"
                    style={{ backgroundColor: accent }}
                  >
                    <Check size={13} /> Approve
                  </button>
                  <button
                    type="button" onClick={() => onResolve(r.id, 'denied')}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 h-10 text-2xs font-medium text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
                  >
                    <X size={13} /> Deny
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h4 className="text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">History</h4>
          <div className="space-y-1.5">
            {resolved.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-500 truncate">
                  {nameOf(r.user_id)} · {fmtCredits(r.amount)} credits
                </span>
                <span className="text-3xs font-semibold uppercase" style={{ color: r.status === 'approved' ? accent : '#E53E3E' }}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
