'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, FileText, DollarSign, Clock, CheckCircle2, AlertCircle,
  ChevronDown, Trash2, Edit3, Copy, Filter,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useInvoiceData } from '@/hooks/useInvoiceData'
import NewInvoiceModal from '@/components/ui/NewInvoiceModal'
import { CURRENCY_SYMBOLS } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { Invoice, Client } from '@/types'

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:   { label: 'Draft',   color: 'bg-gray-100 text-gray-600' },
  sent:    { label: 'Sent',    color: 'bg-blue-100 text-blue-700' },
  paid:    { label: 'Paid',    color: 'bg-green-100 text-green-700' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700' },
}

// ---------------------------------------------------------------------------
// SQL instructions shown when the invoices table is missing
// ---------------------------------------------------------------------------
const SETUP_SQL = `-- Run this in your Supabase SQL editor:

CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID,
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  supply_date DATE,
  line_items JSONB DEFAULT '[]',
  from_details JSONB DEFAULT '{}',
  bill_to JSONB DEFAULT '{}',
  payment_details JSONB DEFAULT '{}',
  totals JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  currency TEXT DEFAULT 'NGN',
  layout TEXT DEFAULT 'left_aligned',
  font_color TEXT DEFAULT '#1a1a1a',
  bg_color TEXT DEFAULT '#ffffff',
  font_family TEXT DEFAULT '',
  custom_sections JSONB DEFAULT '[]',
  invoice_settings JSONB DEFAULT '{}',
  share_token TEXT,
  share_enabled BOOLEAN DEFAULT FALSE,
  task_ids JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own invoices"
  ON invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public shared invoices viewable"
  ON invoices FOR SELECT
  USING (share_enabled = TRUE);`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? '$'
  const n = Number(amount) || 0
  return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getTotal(inv: Invoice): number {
  const totals = (inv.totals as Record<string, unknown>) ?? {}
  return Number(totals.total) || 0
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
interface StatCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  iconColor: string
}

function StatCard({ icon: Icon, label, value, iconColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <Icon size={14} className={iconColor} />
      </div>
      <p className="text-xl font-bold text-gray-900 tracking-tight">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatusDropdown
// ---------------------------------------------------------------------------
interface StatusDropdownProps {
  inv: Invoice
  onStatusChange: (inv: Invoice, newStatus: string) => void
  cfg: { label: string; color: string }
}

function StatusDropdown({ inv, onStatusChange, cfg }: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}
      >
        {cfg.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed w-36 bg-white rounded-xl border border-gray-200 shadow-xl z-50"
            style={{ top: pos.top, left: pos.left }}
          >
            {Object.entries(STATUS_CONFIG).map(([value, { label, color }]) => (
              <button
                key={value}
                onClick={() => { onStatusChange(inv, value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 ${inv.status === value ? 'opacity-50 cursor-default' : ''}`}
              >
                <span className={`inline-block px-2 py-0.5 rounded-full ${color}`}>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function InvoicesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { settings } = useSettings()
  const { canManage } = useWorkspace()
  const { invoices, loading, error, fetchInvoices, updateInvoice, deleteInvoice } = useInvoiceData(user?.id)

  const rows = invoices

  // Clients are not passed as props in App Router; NewInvoiceModal fetches its
  // own client data. We keep a typed empty array for the name-lookup fallback.
  const clients: Client[] = []

  const [showNewModal, setShowNewModal]   = useState(false)
  const [statusFilter, setStatusFilter]   = useState('all')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')
  const [showFilters, setShowFilters]     = useState(false)
  const [copiedId, setCopiedId]           = useState<string | null>(null)

  const defCurrency = settings.currency || 'NGN'

  // Stat computations
  const totalRevenue = rows.filter((i) => i.status === 'paid').reduce((s, i) => s + getTotal(i), 0)
  const openAmount   = rows.filter((i) => i.status === 'sent').reduce((s, i) => s + getTotal(i), 0)
  const paidCount    = rows.filter((i) => i.status === 'paid').length
  const overdueCount = rows.filter((i) => i.status === 'overdue').length

  // Filtering
  const filtered = rows.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    if (dateFrom && inv.issue_date < dateFrom) return false
    if (dateTo && inv.issue_date > dateTo) return false
    return true
  })

  const handleStatusChange = async (inv: Invoice, newStatus: string) => {
    const result = await updateInvoice(inv.id, { status: newStatus } as Partial<Invoice>)
    if (result.error) return
    // Mark linked tasks paid when status transitions to paid
    if (newStatus === 'paid' && inv.task_ids) {
      const raw = inv.task_ids
      const uids: string[] = Array.isArray(raw)
        ? raw
        : JSON.parse(typeof raw === 'string' ? raw : '[]') as string[]
      if (uids.length) {
        await Promise.all(
          uids.map((tid) =>
            supabase.from('tasks').update({ paid: true }).eq('id', tid).eq('user_id', user?.id)
          )
        )
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return
    await deleteInvoice(id)
  }

  const handleCopyLink = (inv: Invoice) => {
    if (!inv.share_enabled || !inv.share_token) return
    const url = `${window.location.origin}/invoice/${inv.share_token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(inv.id)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => null)
  }

  // -------------------------------------------------------------------------
  // Missing-table error state
  // -------------------------------------------------------------------------
  if (error === 'table_missing') {
    return (
      <div className="p-6 md:p-10 max-w-2xl">
        <h1 className="font-display text-2xl font-semibold text-gray-900 mb-2">Invoices</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 mb-1">Database table required</p>
              <p className="text-sm text-amber-700">Run the following SQL in your Supabase dashboard → SQL Editor to enable invoices.</p>
            </div>
          </div>
          <pre className="bg-white border border-amber-200 rounded-xl p-4 text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
            {SETUP_SQL}
          </pre>
          <button
            onClick={() => void fetchInvoices()}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Retry after running SQL
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  return (
    <div className="p-4 md:p-8 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Invoices</h1>
        {canManage && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus size={16} />New Invoice
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={DollarSign}   label="Total Revenue" value={fmtMoney(totalRevenue, defCurrency)} iconColor="text-emerald-500" />
        <StatCard icon={Clock}        label="Open"          value={fmtMoney(openAmount, defCurrency)}   iconColor="text-blue-400" />
        <StatCard icon={CheckCircle2} label="Paid"          value={`${paidCount} invoice${paidCount !== 1 ? 's' : ''}`}       iconColor="text-purple-400" />
        <StatCard icon={AlertCircle}  label="Overdue"       value={`${overdueCount} invoice${overdueCount !== 1 ? 's' : ''}`} iconColor="text-red-400" />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl shadow-sm px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        {/* Status pills */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize min-w-[2.5rem] text-center ${
                statusFilter === s ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              style={statusFilter === s ? { backgroundColor: 'var(--accent)' } : {}}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* Date range toggle */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowFilters((f) => !f)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <Filter size={12} />Date filter
          </button>
        </div>

        {showFilters && (
          <div className="w-full flex items-center gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-gray-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-gray-400"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-xs text-red-500 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div
              className="w-8 h-8 border-2 border-gray-200 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderTopColor: 'var(--accent)' }}
            />
            <p className="text-sm text-gray-400">Loading invoices…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-1">
              <FileText size={22} className="text-gray-300" />
            </div>
            <p className="text-[15px] font-medium text-gray-600">No invoices yet</p>
            <p className="text-[13px] text-gray-400">Create your first invoice to get started</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-3 flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus size={14} />New Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Number</th>
                  <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</th>
                  <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Issued</th>
                  <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Due</th>
                  <th className="text-right px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const billTo = (inv.bill_to as Record<string, unknown>) ?? {}
                  const clientName =
                    (billTo.name as string | undefined) ??
                    clients.find((c) => c.id === inv.client_id)?.name ??
                    '—'
                  const total    = getTotal(inv)
                  const currency = inv.currency || defCurrency
                  const cfg      = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft
                  return (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => router.push(`/invoices/${inv.id}`)}
                          className="font-mono text-sm font-semibold hover:underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          {inv.invoice_number}
                        </button>
                      </td>
                      <td className="px-3 py-3.5 text-gray-700 font-medium max-w-[140px] truncate">{clientName}</td>
                      <td className="px-3 py-3.5 text-gray-500 hidden md:table-cell">{fmtDate(inv.issue_date)}</td>
                      <td className="px-3 py-3.5 text-gray-500 hidden md:table-cell">{fmtDate(inv.due_date)}</td>
                      <td className="px-3 py-3.5 text-right font-semibold text-gray-800">{fmtMoney(total, currency)}</td>
                      <td className="px-3 py-3.5">
                        <StatusDropdown inv={inv} onStatusChange={(i, s) => void handleStatusChange(i, s)} cfg={cfg} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => router.push(`/invoices/${inv.id}`)}
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Edit"
                          >
                            <Edit3 size={13} />
                          </button>
                          {inv.share_enabled && inv.share_token && (
                            <button
                              onClick={() => handleCopyLink(inv)}
                              className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                              title="Copy link"
                              style={{ color: copiedId === inv.id ? 'var(--accent)' : undefined }}
                            >
                              {copiedId === inv.id
                                ? <CheckCircle2 size={13} />
                                : <Copy size={13} className="text-gray-400" />
                              }
                            </button>
                          )}
                          <button
                            onClick={() => void handleDelete(inv.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewInvoiceModal clients={clients} onClose={() => setShowNewModal(false)} />
      )}
    </div>
  )
}
