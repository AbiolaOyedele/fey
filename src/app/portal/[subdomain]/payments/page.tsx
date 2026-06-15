'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { formatDate } from '@/utils/formatDate'
import { CreditCard } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { CURRENCY_SYMBOLS } from '@/lib/constants'
import type { PortalPayment } from '@/types/crm'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid:    'bg-emerald-100 text-emerald-700',
  expired: 'bg-gray-100 text-gray-500',
}

function fmtMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PortalPaymentsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const [payments, setPayments] = useState<PortalPayment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  const load = useCallback(async () => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    if (!token) { setLoading(false); return }
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/v1/portal/payments', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { setError(true); return }
      const d = await res.json() as { payments: PortalPayment[] }
      setPayments(d.payments)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        {!loading && !error && (
          <p className="text-sm text-gray-400 mt-0.5">{payments.length} payment request{payments.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CreditCard size={32} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">Couldn&apos;t load your payments</p>
          <button onClick={() => void load()} className="text-xs2 mt-2 underline text-gray-500 hover:text-gray-700">Try again</button>
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CreditCard size={32} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">No payment requests yet</p>
          <p className="text-xs2 text-gray-400 mt-1">Payment requests sent to you will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 last:border-b-0">
              <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <CreditCard size={16} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.description || 'Payment request'}</p>
                <p className="text-xs text-gray-400">
                  {formatDate(p.created_at)}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmtMoney(p.amount, p.currency)}</span>
              <span className={`text-2xs font-semibold px-2.5 py-0.5 rounded-full capitalize flex-shrink-0 ${STATUS_BADGE[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {p.status}
              </span>
              {p.status === 'pending' && p.share_token && (
                <a
                  href={`/pay/${p.share_token}`}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                >
                  Pay
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
