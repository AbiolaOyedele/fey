'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { FileText, ExternalLink } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { CURRENCY_SYMBOLS } from '@/lib/constants'
import type { PortalInvoice } from '@/types/crm'

const STATUS_BADGE: Record<string, string> = {
  sent:    'bg-blue-100 text-blue-700',
  viewed:  'bg-purple-100 text-purple-700',
  paid:    'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-600',
}

function fmtMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PortalInvoicesPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const [invoices, setInvoices] = useState<PortalInvoice[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  const load = useCallback(async () => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    if (!token) { setLoading(false); return }
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/v1/portal/invoices', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { setError(true); return }
      const d = await res.json() as { invoices: PortalInvoice[] }
      setInvoices(d.invoices)
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
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        {!loading && !error && (
          <p className="text-sm text-gray-400 mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText size={32} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">Couldn&apos;t load your invoices</p>
          <button onClick={() => void load()} className="text-xs2 mt-2 underline text-gray-500 hover:text-gray-700">Try again</button>
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText size={32} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">No invoices yet</p>
          <p className="text-xs2 text-gray-400 mt-1">Invoices sent to you will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {invoices.map((inv) => {
            const viewable = inv.share_token && inv.share_enabled
            const row = (
              <>
                <FileText size={16} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                  {inv.invoice_number || 'Invoice'}
                </span>
                <span className="text-xs2 font-semibold text-gray-800 flex-shrink-0">{fmtMoney(inv.amount, inv.currency)}</span>
                <span className={`text-2xs font-semibold px-2.5 py-0.5 rounded-full capitalize flex-shrink-0 ${STATUS_BADGE[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {inv.status}
                </span>
                {viewable && <ExternalLink size={14} className="text-gray-300 flex-shrink-0" />}
              </>
            )
            return viewable ? (
              <a
                key={inv.id}
                href={`/invoice/${inv.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 h-14 px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 transition-colors"
              >
                {row}
              </a>
            ) : (
              <div key={inv.id} className="flex items-center gap-3 h-14 px-4 border-b border-gray-100 last:border-b-0">
                {row}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
