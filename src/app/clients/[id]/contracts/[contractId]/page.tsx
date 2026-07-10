'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useContracts, useContacts } from '@/hooks/useCrm'
import { useWorkspace } from '@/hooks/useWorkspace'
import ContractBuilder from '@/components/crm/ContractBuilder'
import type { CrmContract } from '@/types/crm'

export default function ContractDetailPage({ params }: { params: Promise<{ id: string; contractId: string }> }) {
  const { id, contractId } = use(params)
  const router = useRouter()
  const { contacts } = useContacts()
  const { contracts, loading, updateContract, sendContract } = useContracts(id)
  const { canManage } = useWorkspace()

  const contract = contracts.find((c) => c.id === contractId)
  const contact  = contacts.find((c) => c.id === id)

  // Wait for the async contracts fetch before deciding the contract is missing —
  // otherwise a direct link / refresh flashes "Contract not found" until it loads.
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-400 text-lg">Contract not found.</p>
          <button
            onClick={() => router.push(`/clients/${id}/contracts`)}
            className="text-sm mt-2 hover:underline"
            style={{ color: 'var(--accent, #ED64A6)' }}
          >
            Back to contracts
          </button>
        </div>
      </div>
    )
  }

  return (
    <ContractBuilder
      contract={contract}
      contactName={contact?.name ?? null}
      contactEmail={contact?.email ?? null}
      onSave={async (_id, payload) => { await updateContract(contractId, payload as Partial<CrmContract>) }}
      onSend={async (_id, to) => { await sendContract(contractId, to) }}
      onBack={() => router.push(`/clients/${id}/contracts`)}
      readOnly={!canManage}
    />
  )
}
