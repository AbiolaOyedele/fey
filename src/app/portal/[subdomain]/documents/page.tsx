'use client'

import { use, useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { usePortalBase } from '@/hooks/usePortalBase'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { FadeIn } from '@/components/ui/motion'
import DocumentsHub, { type DocumentSection } from '@/components/crm/DocumentsHub'

/**
 * Documents — the client's side of the same consolidation the owner sees.
 * Files, Contracts, Forms, Payments and Invoices behind one tab, each card
 * showing what's actually waiting on them.
 */
export default function PortalDocumentsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const base   = usePortalBase(subdomain)
  const accent = usePortalAccent(subdomain)

  const [counts, setCounts] = useState({ files: 0, contracts: 0, forms: 0, payments: 0, invoices: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const token = localStorage.getItem(portalTokenKey(subdomain))
      if (!token) { setLoading(false); return }
      const headers = { Authorization: `Bearer ${token}` }

      const [filesRes, contractsRes, formsRes, paymentsRes, invoicesRes] = await Promise.all([
        fetch('/api/v1/portal/files',     { headers }),
        fetch('/api/v1/portal/contracts', { headers }),
        fetch('/api/v1/portal/forms',     { headers }),
        fetch('/api/v1/portal/payments',  { headers }),
        fetch('/api/v1/portal/invoices',  { headers }),
      ])

      // Each count is independent — one section failing shouldn't blank the
      // others, so every read falls back to zero on its own.
      const safe = async <T,>(res: Response, pick: (json: never) => T, fallback: T): Promise<T> => {
        if (!res.ok) return fallback
        try { return pick(await res.json() as never) } catch { return fallback }
      }

      setCounts({
        files:     await safe(filesRes,     (d: { files?: unknown[] }) => d.files?.length ?? 0, 0),
        contracts: await safe(contractsRes, (d: { contracts?: Array<{ status?: string }> }) => (d.contracts ?? []).filter((c) => c.status === 'sent').length, 0),
        forms:     await safe(formsRes,     (d: { forms?: Array<{ status?: string }> }) => (d.forms ?? []).filter((f) => f.status === 'sent').length, 0),
        payments:  await safe(paymentsRes,  (d: { payments?: Array<{ status?: string }> }) => (d.payments ?? []).filter((p) => p.status !== 'paid').length, 0),
        invoices:  await safe(invoicesRes,  (d: { invoices?: Array<{ status?: string }> }) => (d.invoices ?? []).filter((i) => i.status !== 'paid').length, 0),
      })
      setLoading(false)
    })()
  }, [subdomain])

  const sections: DocumentSection[] = [
    {
      key: 'files',
      label: 'Files',
      description: 'Documents and assets shared with you.',
      count: counts.files,
      countLabel: `${counts.files} ${counts.files === 1 ? 'file' : 'files'} shared`,
    },
    {
      key: 'contracts',
      label: 'Contracts',
      description: 'Agreements to review and sign.',
      count: counts.contracts,
      countLabel: `${counts.contracts} waiting for your signature`,
    },
    {
      key: 'forms',
      label: 'Forms',
      description: 'Questionnaires and requests to fill in.',
      count: counts.forms,
      countLabel: `${counts.forms} waiting to be filled in`,
    },
    {
      key: 'payments',
      label: 'Payments',
      description: 'Anything waiting to be paid.',
      count: counts.payments,
      countLabel: `${counts.payments} outstanding`,
    },
    {
      key: 'invoices',
      label: 'Invoices',
      description: 'Billing and payment history.',
      count: counts.invoices,
      countLabel: `${counts.invoices} unpaid`,
    },
    {
      key: 'vault',
      label: 'Vault',
      description: 'Everything in one list — invoices, contracts and shared documents.',
      // Deliberately no count. The Vault gathers up what the other cards
      // already count, so a number here would double what's above it.
      count: 0,
      countLabel: 'All your documents',
    },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <FileText size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Documents</h1>
        </div>
        <p className="text-xs text-gray-400 mb-6">Files, contracts, forms and billing — all in one place.</p>
      </FadeIn>

      <DocumentsHub base={base} accent={accent} sections={sections} loading={loading} />
    </div>
  )
}
