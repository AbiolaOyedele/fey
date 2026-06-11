'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ExternalLink, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Invoice } from '@/types'
import type { CrmContact } from '@/types/crm'

// ── Status badge styles ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600',
  sent:    'bg-blue-100 text-blue-700',
  viewed:  'bg-purple-100 text-purple-700',
  paid:    'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-600',
  void:    'bg-gray-100 text-gray-400',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoicesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [contact,  setContact]  = useState<CrmContact | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Fetch contact + linked invoices ──────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return
    void (async () => {
      const [{ data: contactRow }, { data: invRows }] = await Promise.all([
        supabase
          .from('crm_contacts')
          .select('*')
          .eq('id', id)
          .eq('owner_id', user.id)
          .single(),
        supabase
          .from('invoices')
          .select('*')
          .eq('user_id', user.id)
          .eq('crm_contact_id', id)
          .order('created_at', { ascending: false }),
      ])
      setContact(contactRow as CrmContact | null)
      setInvoices((invRows as Invoice[]) ?? [])
      setLoading(false)
    })()
  }, [user?.id, id])

  // ── Create invoice + navigate to editor ──────────────────────────────────

  const handleNew = useCallback(async () => {
    if (!user?.id || creating) return
    setCreating(true)
    try {
      const today = new Date().toISOString().split('T')[0]!
      const due   = (() => {
        const d = new Date()
        d.setDate(d.getDate() + 14)
        return d.toISOString().split('T')[0]!
      })()

      const billTo = {
        client_id: '',
        name:    contact?.name    ?? '',
        email:   contact?.email   ?? '',
        phone:   contact?.phone   ?? '',
        address: '',
        website: '',
        tax_id:  '',
      }

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          user_id:         user.id,
          app:             'fey',
          crm_contact_id:  id,
          invoice_number:  '',
          status:          'draft',
          issue_date:      today,
          due_date:        due,
          from_details:    {},
          bill_to:         billTo,
          line_items:      [],
          task_ids:        [],
          custom_sections: [],
          payment_details: {},
          totals:          { additions: [], showSignature: false, subtotal: 0, total: 0 },
          notes:           '',
          invoice_settings: {},
          currency:        'USD',
          layout:          'left_aligned',
          font_color:      '#1a1a1a',
          bg_color:        '#ffffff',
          font_family:     '',
          share_enabled:   false,
        })
        .select()
        .single()

      if (error !== null || data === null) {
        showToast(error?.message ?? 'Failed to create invoice', false)
        return
      }

      const returnTo = encodeURIComponent(`/clients/${id}/invoices`)
      router.push(`/invoices/${(data as Invoice).id}?returnTo=${returnTo}`)
    } finally {
      setCreating(false)
    }
  }, [user?.id, id, contact, creating, router, showToast])

  // ── Open existing invoice in editor ──────────────────────────────────────

  const handleOpen = useCallback((invId: string) => {
    const returnTo = encodeURIComponent(`/clients/${id}/invoices`)
    router.push(`/invoices/${invId}?returnTo=${returnTo}`)
  }, [id, router])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          <p className="text-sm text-gray-400">
            {loading ? '…' : `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => void handleNew()}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
        >
          <Plus size={14} />
          {creating ? 'Creating…' : 'New Invoice'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText size={32} className="text-gray-200 mb-3" />
          <p className="text-[15px] font-medium text-gray-500 mb-1">No invoices yet</p>
          <p className="text-[13px] text-gray-400 mb-5">Create an invoice for this contact.</p>
          <button
            onClick={() => void handleNew()}
            disabled={creating}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            {creating ? 'Creating…' : '+ New Invoice'}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              onClick={() => handleOpen(inv.id)}
              className="flex items-center gap-3 h-14 px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 transition-colors cursor-pointer"
            >
              <FileText size={16} className="text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-[14px] font-medium text-gray-900 truncate">
                {inv.invoice_number || 'Untitled Invoice'}
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_BADGE[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {inv.status}
              </span>
              <span className="text-[12px] text-gray-400 flex-shrink-0">
                {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {inv.share_token && inv.share_enabled && (
                <a
                  href={`/invoice/${inv.share_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-gray-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium pointer-events-none transition-all ${
          toast.ok ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
