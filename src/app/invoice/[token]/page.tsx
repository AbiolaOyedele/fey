'use client'

import { use, useState, useEffect } from 'react'
import { fetchPublicInvoice } from '@/hooks/useInvoiceData'
import { FileDown, AlertCircle, Loader2, CreditCard } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { Invoice } from '@/types'

interface FromDetails {
  logo?: string
  name?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  tax_id?: string
}

interface BillTo {
  name?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  tax_id?: string
}

interface LineItem {
  description: string
  qty: number
  price: number
}

interface Addition {
  label: string
  value: number
  isPercent: boolean
  sign: number
}

interface Totals {
  additions?: Addition[]
}

interface PaymentDetails {
  method?: string
  fields?: Record<string, string>
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function fmt(n: number | string | undefined, currency = 'USD'): string {
  return `${currency} ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [payingNow, setPayingNow] = useState(false)

  useEffect(() => {
    void fetchPublicInvoice(token).then(({ data, error: err }) => {
      if (err) setError(err)
      else setInvoice(data ?? null)
      setLoading(false)
    })
  }, [token])

  const handleDownload = async () => {
    const el = document.getElementById('invoice-document')
    if (!el) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        ignoreElements: (elem) => {
          const s = window.getComputedStyle(elem)
          return s.position === 'fixed' && !el.contains(elem)
        },
      })
      const imgW = 210
      const imgH = (canvas.height * imgW) / canvas.width
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [imgW, imgH] })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH)
      const invoiceNumber = (invoice?.invoice_number ?? 'download')
      pdf.save(`invoice-${invoiceNumber}.pdf`)
    } catch {
      // PDF generation failure — user can retry
    } finally {
      setDownloading(false)
    }
  }

  const handlePayNow = async () => {
    if (!invoice) return
    setPayingNow(true)
    try {
      const billToData = (invoice.bill_to as BillTo | undefined) ?? {}
      const totalsData = (invoice.totals as Totals | undefined) ?? {}
      const invoiceTotal = totalsData.additions
        ? (() => {
            const lineItemsData = (invoice.line_items as Array<{ qty: number; price: number }> | undefined) ?? []
            const sub = lineItemsData.reduce((s, li) => s + Number(li.qty ?? 0) * Number(li.price ?? 0), 0)
            let t = sub
            for (const a of (totalsData.additions as Array<{ value: number; isPercent: boolean; sign: number }> ?? [])) {
              const amt = a.isPercent ? (sub * Number(a.value ?? 0)) / 100 : Number(a.value ?? 0)
              t += a.sign === -1 ? -amt : amt
            }
            return t
          })()
        : 0

      const res = await fetch('/api/v1/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          email: billToData.email ?? '',
          amount: invoiceTotal,
          currency: invoice.currency ?? 'NGN',
        }),
      })

      const json = await res.json() as { authorizationUrl?: string; error?: { message: string } }

      if (!res.ok || !json.authorizationUrl) {
        alert(json.error?.message ?? 'Could not initialize payment. Please try again.')
        return
      }

      // Redirect to Paystack payment page
      window.location.href = json.authorizationUrl
    } catch {
      alert('Network error. Please check your connection and try again.')
    } finally {
      setPayingNow(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
      </div>
    )
  }

  if (error ?? !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="mx-auto mb-3 text-gray-300" />
          <h1 className="text-lg font-semibold text-gray-800 mb-1">Invoice not found</h1>
          <p className="text-sm text-gray-400">This link may have expired or the invoice is no longer public.</p>
        </div>
      </div>
    )
  }

  const from = (invoice.from_details as FromDetails | undefined) ?? {}
  const billTo = (invoice.bill_to as BillTo | undefined) ?? {}
  const lineItems = (invoice.line_items as LineItem[] | undefined) ?? []
  const totals = (invoice.totals as Totals | undefined) ?? {}
  const payment = (invoice.payment_details as PaymentDetails | undefined) ?? {}
  const currency = invoice.currency ?? 'USD'
  const invoiceNumber = invoice.invoice_number ?? ''
  const status = invoice.status ?? 'draft'
  const issueDate = invoice.issue_date ?? ''
  const dueDate = invoice.due_date ?? ''
  const notes = invoice.notes ?? ''
  const invoiceSettings = invoice.invoice_settings as Record<string, unknown> | undefined

  const subtotal = lineItems.reduce((s, li) => s + Number(li.qty ?? 0) * Number(li.price ?? 0), 0)
  const additions = totals.additions ?? []
  let total = subtotal
  for (const a of additions) {
    const amt = a.isPercent ? (subtotal * Number(a.value ?? 0)) / 100 : Number(a.value ?? 0)
    total += a.sign === -1 ? -amt : amt
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      {/* Download bar */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">W</span>
          </div>
          <span>Sent via Fey</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Pay Now — shown when invoice is payable and Paystack is configured */}
          {status !== 'paid' && process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY && (
            <button
              onClick={() => void handlePayNow()}
              disabled={payingNow}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-60"
            >
              {payingNow ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              {payingNow ? 'Redirecting…' : 'Pay Now'}
            </button>
          )}
          <button
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {downloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Invoice document */}
      <div
        id="invoice-document"
        className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden print:shadow-none print:rounded-none"
      >
        {/* Header */}
        <div className="px-10 pt-10 pb-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              {from.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={from.logo} alt="Logo" className="h-12 mb-3 object-contain" />
              )}
              <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
              <p className="text-sm text-gray-400 mt-0.5">#{invoiceNumber}</p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[status] ?? STATUS_COLORS['draft']}`}
              >
                {status}
              </span>
              <p className="text-xs text-gray-400 mt-2">Issued: {fmtDate(issueDate)}</p>
              <p className="text-xs text-gray-500 font-medium">Due: {fmtDate(dueDate)}</p>
            </div>
          </div>

          {/* From / Bill To */}
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <p className="text-3xs font-bold text-gray-400 uppercase tracking-widest mb-2">From</p>
              {from.name && <p className="text-sm font-semibold text-gray-800 mb-0.5">{from.name}</p>}
              {from.email && <p className="text-sm text-gray-500 mb-0.5">{from.email}</p>}
              {from.phone && <p className="text-sm text-gray-500 mb-0.5">{from.phone}</p>}
              {from.website && <p className="text-sm text-gray-500 mb-0.5">{from.website}</p>}
              {from.address && <p className="text-sm text-gray-500 whitespace-pre-line mb-0.5">{from.address}</p>}
              {from.tax_id && <p className="text-sm text-gray-400 mb-0.5">Tax ID: {from.tax_id}</p>}
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <p className="text-3xs font-bold text-gray-400 uppercase tracking-widest mb-2">Bill To</p>
              {billTo.name && <p className="text-sm font-semibold text-gray-800 mb-0.5">{billTo.name}</p>}
              {billTo.email && <p className="text-sm text-gray-500 mb-0.5">{billTo.email}</p>}
              {billTo.phone && <p className="text-sm text-gray-500 mb-0.5">{billTo.phone}</p>}
              {billTo.website && <p className="text-sm text-gray-500 mb-0.5">{billTo.website}</p>}
              {billTo.address && <p className="text-sm text-gray-500 whitespace-pre-line mb-0.5">{billTo.address}</p>}
              {billTo.tax_id && <p className="text-sm text-gray-400 mb-0.5">Tax ID: {billTo.tax_id}</p>}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="px-10 pb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Description
                </th>
                <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-16">
                  Qty
                </th>
                <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">
                  Price
                </th>
                <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineItems.map((li, i) => (
                <tr key={i}>
                  <td className="py-3 text-gray-700">{li.description}</td>
                  <td className="py-3 text-right text-gray-500">{li.qty}</td>
                  <td className="py-3 text-right text-gray-500">{fmt(li.price, currency)}</td>
                  <td className="py-3 text-right font-medium text-gray-800">
                    {fmt(li.qty * li.price, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6 ml-auto w-64">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Subtotal</span>
              <span>{fmt(subtotal, currency)}</span>
            </div>
            {additions.map((a, i) => {
              const amt = a.isPercent ? (subtotal * Number(a.value ?? 0)) / 100 : Number(a.value ?? 0)
              return (
                <div key={i} className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>
                    {a.label}
                    {a.isPercent ? ` (${a.value}%)` : ''}
                  </span>
                  <span>
                    {a.sign === -1 ? '−' : '+'} {fmt(amt, currency)}
                  </span>
                </div>
              )
            })}
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-3 mt-1">
              <span>Total</span>
              <span>{fmt(total, currency)}</span>
            </div>
          </div>
        </div>

        {/* Payment details */}
        {payment.method && invoiceSettings?.show_payment !== false && (
          <div className="px-10 pb-8">
            <p className="text-3xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Details</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-800">{payment.method}</p>
              {Object.entries(payment.fields ?? {}).map(([k, v]) => (
                <p key={k}>
                  <span className="text-gray-400">{k}:</span> {v}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div className="px-10 pb-10">
            <p className="text-3xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
            <p className="text-sm text-gray-500 whitespace-pre-line">{notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto px-10 py-5 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-300">Created with Fey</p>
          <p className="text-xs text-gray-400 font-medium">{invoiceNumber}</p>
        </div>
      </div>
    </div>
  )
}
