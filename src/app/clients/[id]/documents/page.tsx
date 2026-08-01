'use client'

import { use } from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import { useCrmFiles, useContracts, useForms } from '@/hooks/useCrm'
import DocumentsHub, { type DocumentSection } from '@/components/crm/DocumentsHub'

/**
 * Documents — one tab in place of the five that used to sit here (Files,
 * Contracts, Forms, Payments, Invoices). Each still has its own page; this is
 * the way in, with a live count where a section has something outstanding.
 *
 * Payments and Invoices carry no count yet: they have no shared hook the way
 * files/contracts/forms do, and inventing a fetch here would put data loading
 * in a place that shouldn't own it. The cards work regardless — a missing count
 * simply renders no badge.
 */
export default function DocumentsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'

  const { files, loading: filesLoading }         = useCrmFiles(id)
  const { contracts, loading: contractsLoading } = useContracts(id)
  const { forms, loading: formsLoading }         = useForms(id)

  const awaitingSignature = contracts.filter((c) => c.status === 'sent').length
  const awaitingResponse  = forms.filter((f) => f.status === 'sent').length

  const sections: DocumentSection[] = [
    {
      key: 'files',
      label: 'Files',
      description: 'Documents and assets shared with this client.',
      count: files.length,
      countLabel: `${files.length} ${files.length === 1 ? 'file' : 'files'} shared`,
    },
    {
      key: 'contracts',
      label: 'Contracts',
      description: 'Agreements to draft, send and sign.',
      count: awaitingSignature,
      countLabel: `${awaitingSignature} awaiting signature`,
    },
    {
      key: 'forms',
      label: 'Forms',
      description: 'Questionnaires and intake requests.',
      count: awaitingResponse,
      countLabel: `${awaitingResponse} awaiting a response`,
    },
    {
      key: 'payments',
      label: 'Payments',
      description: 'Payment requests and their status.',
    },
    {
      key: 'invoices',
      label: 'Invoices',
      description: 'Billing history and outstanding invoices.',
    },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <div className="mb-6">
        <h1 className="font-display text-xl font-normal text-gray-800">Documents</h1>
        <p className="text-xs text-gray-400 mt-1">Everything on paper for this client, in one place.</p>
      </div>

      <DocumentsHub
        base={`/clients/${id}`}
        accent={accent}
        sections={sections}
        loading={filesLoading || contractsLoading || formsLoading}
      />
    </div>
  )
}
