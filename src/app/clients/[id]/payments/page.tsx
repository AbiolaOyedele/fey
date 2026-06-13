'use client'

import { use, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  CreditCard, FileText, Plus, ChevronDown, X, Copy, Check,
  Link2, ExternalLink, Loader2, Clock, Ban,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import type { Invoice } from '@/types'
import type { CrmPaymentRequest } from '@/types/crm'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string
  title: string
  amount: number
  currency: string
  paid: boolean
  done: boolean
  deadline: string | null
  created_at: string
}

type RequestOption = 'invoice' | 'direct'

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', GBP: '£', EUR: '€', ZAR: 'R', KES: 'KSh', GHS: '₵',
}

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'ZAR']

const STATUS_BADGE: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600',
  sent:    'bg-blue-100 text-blue-700',
  viewed:  'bg-purple-100 text-purple-700',
  paid:    'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-600',
  void:    'bg-gray-100 text-gray-400',
}

const REQUEST_STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  paid:      'bg-emerald-100 text-emerald-700',
  expired:   'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-500',
}

const REQUEST_STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Clock   size={11} />,
  paid:      <Check   size={11} />,
  expired:   <Ban     size={11} />,
  cancelled: <X       size={11} />,
}

function fmt(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + ' '
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Request option dropdown ───────────────────────────────────────────────────

interface RequestDropdownProps {
  onSelect: (opt: RequestOption) => void
}

function RequestDropdown({ onSelect }: RequestDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
      >
        <Plus size={14} /> Request Payment
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-2xl border border-gray-200 z-20 overflow-hidden py-1 shadow-lg">
          <button
            onClick={() => { setOpen(false); onSelect('invoice') }}
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText size={14} className="text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Request via Invoice</p>
              <p className="text-xs text-gray-400 leading-snug mt-0.5">Choose an existing invoice or create a new one</p>
            </div>
          </button>
          <div className="h-px bg-gray-100 mx-3" />
          <button
            onClick={() => { setOpen(false); onSelect('direct') }}
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Link2 size={14} className="text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Send Direct Link</p>
              <p className="text-xs text-gray-400 leading-snug mt-0.5">Share a payment link with amount and details</p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Invoice picker modal ──────────────────────────────────────────────────────

interface InvoicePickerProps {
  contactId: string
  userId: string
  onClose: () => void
  onNew: () => void
}

function InvoicePickerModal({ contactId, userId, onClose, onNew }: InvoicePickerProps) {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .eq('crm_contact_id', contactId)
        .order('created_at', { ascending: false })
      setInvoices((data as Invoice[]) ?? [])
    })()
  }, [userId, contactId])

  const handleOpen = (invId: string) => {
    const returnTo = encodeURIComponent(`/clients/${contactId}/payments`)
    router.push(`/invoices/${invId}?returnTo=${returnTo}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Request via Invoice</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {invoices === null ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-10 px-5 text-center">
              <FileText size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No invoices yet</p>
              <p className="text-xs text-gray-400 mt-1">Create a new invoice to send to this contact.</p>
            </div>
          ) : (
            <div>
              {invoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => handleOpen(inv.id)}
                  className="w-full flex items-center gap-3 h-14 px-5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-left"
                >
                  <FileText size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{inv.invoice_number || 'Untitled Invoice'}</span>
                  <span className={`text-3xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_BADGE[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>{inv.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => { onClose(); onNew() }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            <Plus size={14} /> Create new invoice
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Direct link modal ─────────────────────────────────────────────────────────

interface DirectLinkModalProps {
  contactId: string
  userId: string
  defaultCurrency: string
  onClose: () => void
  onCreated: (req: CrmPaymentRequest) => void
}

function DirectLinkModal({ contactId, userId, defaultCurrency, onClose, onCreated }: DirectLinkModalProps) {
  const [amount,      setAmount]      = useState('')
  const [currency,    setCurrency]    = useState(defaultCurrency)
  const [description, setDescription] = useState('')
  const [message,     setMessage]     = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const [created,  setCreated]  = useState<CrmPaymentRequest | null>(null)
  const [copied,   setCopied]   = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const handleSubmit = async () => {
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount greater than 0.'); return }
    if (!description.trim()) { setError('Add a description for this payment.'); return }

    setSaving(true)
    setError('')

    const { data, error: err } = await supabase
      .from('crm_payment_requests')
      .insert({
        owner_id:    userId,
        contact_id:  contactId,
        amount:      amt,
        currency,
        description: description.trim(),
        message:     message.trim(),
      })
      .select()
      .single()

    setSaving(false)

    if (err ?? !data) {
      setError(err?.message ?? 'Failed to create payment request.')
      return
    }

    const req = data as CrmPaymentRequest
    setCreated(req)
    onCreated(req)
  }

  const payLink = created ? `${appUrl}/pay/${created.share_token}` : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* fallback */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={created ? undefined : onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">
            {created ? 'Payment link ready' : 'Send Direct Link'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>

        {created ? (
          /* ── Success state ── */
          <div className="p-5 space-y-4">
            <div className="bg-emerald-50 rounded-2xl p-4 text-center">
              <Check size={28} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-900">Payment request created</p>
              <p className="text-xs text-gray-500 mt-0.5">{fmt(created.amount, created.currency)} · {created.description}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5">Share this link with your client</p>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <span className="flex-1 text-xs text-gray-700 truncate font-mono">{payLink}</span>
                <button
                  onClick={() => void handleCopy()}
                  className="flex items-center gap-1 text-xs font-medium flex-shrink-0 transition-colors"
                  style={{ color: 'var(--accent, #ED64A6)' }}
                >
                  {copied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
                </button>
              </div>
              <p className="text-2xs text-gray-400 mt-1.5">
                They&apos;ll enter their email and pay securely via Paystack.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <div className="p-5 space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount</label>
              <div className="flex items-center gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 appearance-none cursor-pointer flex-shrink-0"
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setError('') }}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError('') }}
                placeholder="e.g. Brand design — Phase 1"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Message <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi, please find your payment link below…"
                rows={3}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                {saving ? <><Loader2 size={14} className="animate-spin" />Creating…</> : 'Generate Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()
  const { user } = useAuth()
  const { settings } = useSettings()
  const { canManage } = useWorkspace()

  const [tasks,    setTasks]    = useState<TaskRow[]>([])
  const [requests, setRequests] = useState<CrmPaymentRequest[]>([])
  const [loading,  setLoading]  = useState(true)

  const [modal, setModal] = useState<RequestOption | null>(null)

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // ── Fetch ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return
    void (async () => {
      const [tasksRes, requestsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, amount, currency, paid, done, deadline, created_at')
          .eq('user_id', user.id)
          .eq('client_id', id)
          .gt('amount', 0)
          .order('created_at', { ascending: false }),
        supabase
          .from('crm_payment_requests')
          .select('*')
          .eq('owner_id', user.id)
          .eq('contact_id', id)
          .order('created_at', { ascending: false }),
      ])
      setTasks((tasksRes.data as TaskRow[]) ?? [])
      setRequests((requestsRes.data as CrmPaymentRequest[]) ?? [])
      setLoading(false)
    })()
  }, [user?.id, id])

  // ── Computed totals ───────────────────────────────────────────────────────

  const primaryCurrency = tasks[0]?.currency ?? requests[0]?.currency ?? (settings.currency || 'NGN')

  const taskTotal = tasks.reduce((s, t) => s + t.amount, 0)
  const taskPaid  = tasks.filter((t) => t.paid).reduce((s, t) => s + t.amount, 0)

  const reqPaid = requests.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
  const reqPending = requests.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0)

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleNewInvoice = useCallback(async () => {
    if (!user?.id) return
    const today = new Date().toISOString().split('T')[0]!
    const due   = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().split('T')[0]! })()
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id, app: 'fey', crm_contact_id: id,
        invoice_number: '', status: 'draft',
        issue_date: today, due_date: due,
        from_details: {}, bill_to: {}, line_items: [],
        task_ids: [], custom_sections: [], payment_details: {},
        totals: { subtotal: 0, total: 0, additions: [], showSignature: false },
        notes: '', invoice_settings: {},
        currency: 'USD', layout: 'left_aligned', font_color: '#1a1a1a',
        bg_color: '#ffffff', font_family: '', share_enabled: false,
      })
      .select().single()
    if (!error && data) {
      const returnTo = encodeURIComponent(`/clients/${id}/payments`)
      router.push(`/invoices/${(data as { id: string }).id}?returnTo=${returnTo}`)
    }
  }, [user?.id, id, router])

  const handleCopyLink = useCallback(async (req: CrmPaymentRequest) => {
    const link = `${appUrl}/pay/${req.share_token}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(req.id)
      setTimeout(() => setCopiedId(null), 2500)
    } catch { /* fallback */ }
  }, [appUrl])

  const handleCancelRequest = useCallback(async (reqId: string) => {
    if (!user?.id) return
    await supabase
      .from('crm_payment_requests')
      .update({ status: 'cancelled' })
      .eq('id', reqId)
      .eq('owner_id', user.id)
    setRequests((prev) => prev.map((r) => r.id === reqId ? { ...r, status: 'cancelled' as const } : r))
  }, [user?.id])

  const handleRequestCreated = useCallback((req: CrmPaymentRequest) => {
    setRequests((prev) => [req, ...prev])
  }, [])

  // ── Loading ────────────────────────────────────────────────────────────────

  const hasData = tasks.length > 0 || requests.length > 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
          <p className="text-sm text-gray-400">
            {loading ? '…' : `${requests.length} request${requests.length !== 1 ? 's' : ''} · ${tasks.length} billable task${tasks.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {canManage && <RequestDropdown onSelect={(opt) => setModal(opt)} />}
      </div>

      {/* Summary cards */}
      {!loading && hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Tasks billed',   value: fmt(taskTotal, primaryCurrency) },
            { label: 'Tasks collected', value: fmt(taskPaid, primaryCurrency) },
            { label: 'Req. paid',       value: fmt(reqPaid, primaryCurrency) },
            { label: 'Req. pending',    value: fmt(reqPending, primaryCurrency) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className="text-base font-bold text-gray-900 mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CreditCard size={32} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500 mb-1">No payments yet</p>
          <p className="text-xs2 text-gray-400">Request a payment via invoice or send a direct payment link.</p>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setModal('invoice')} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: 'var(--accent, #ED64A6)' }}>
              <FileText size={13} />Via Invoice
            </button>
            <button onClick={() => setModal('direct')} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
              <Link2 size={13} />Direct Link
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Payment requests */}
          {requests.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment Requests</p>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {requests.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 h-16 px-4 border-b border-gray-50 last:border-0 group">
                    <Link2 size={15} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs2 font-medium text-gray-900 truncate">{req.description || 'Payment request'}</p>
                      <p className="text-2xs text-gray-400">{shortDate(req.created_at)}</p>
                    </div>
                    <span className="text-xs2 font-semibold text-gray-800">{fmt(req.amount, req.currency)}</span>
                    <span className={`flex items-center gap-1 text-3xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${REQUEST_STATUS_BADGE[req.status] ?? ''}`}>
                      {REQUEST_STATUS_ICON[req.status]}
                      {req.status}
                    </span>
                    {req.status === 'pending' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => void handleCopyLink(req)}
                          title="Copy payment link"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          {copiedId === req.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                        <a
                          href={`${appUrl}/pay/${req.share_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open payment page"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <ExternalLink size={13} />
                        </a>
                        <button
                          onClick={() => void handleCancelRequest(req.id)}
                          title="Cancel request"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Billable tasks */}
          {tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Billable Tasks</p>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 h-14 px-4 border-b border-gray-50 last:border-0">
                    <CreditCard size={15} className="text-gray-400 flex-shrink-0" />
                    <span className="flex-1 text-xs2 font-medium text-gray-900 truncate">{task.title}</span>
                    <span className="text-xs2 font-semibold text-gray-800">{fmt(task.amount, task.currency)}</span>
                    <span className={`text-3xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${task.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {task.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modal === 'invoice' && user?.id && (
        <InvoicePickerModal
          contactId={id}
          userId={user.id}
          onClose={() => setModal(null)}
          onNew={() => { setModal(null); void handleNewInvoice() }}
        />
      )}
      {modal === 'direct' && user?.id && (
        <DirectLinkModal
          contactId={id}
          userId={user.id}
          defaultCurrency={settings.currency || 'NGN'}
          onClose={() => setModal(null)}
          onCreated={handleRequestCreated}
        />
      )}
    </div>
  )
}
