'use client'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { portalBasePath } from '@/hooks/usePortalBase'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileSignature } from 'lucide-react'
import type { CrmContract, ContractStatus } from '@/types/crm'

const STATUS_BADGE: Record<ContractStatus, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  signed:   'bg-emerald-100 text-emerald-700',
  declined: 'bg-red-100 text-red-600',
}

export default function PortalContractsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const router = useRouter()
  const [contracts, setContracts] = useState<CrmContract[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    void (async () => {
      const token = localStorage.getItem(portalTokenKey(subdomain))
      if (!token) { setLoading(false); return }
      const res = await fetch('/api/v1/portal/contracts', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const d = await res.json() as { contracts: CrmContract[] }
        setContracts(d.contracts)
      }
      setLoading(false)
    })()
  }, [subdomain])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
        <p className="text-sm text-gray-400 mt-0.5">{contracts.length} contract{contracts.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileSignature size={32} className="text-gray-200 mb-3" />
          <p className="text-[15px] font-medium text-gray-500">No contracts yet</p>
          <p className="text-[13px] text-gray-400 mt-1">Contracts sent to you will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {contracts.map((c) => (
            <div
              key={c.id}
              onClick={() => router.push(`${portalBasePath(subdomain)}/contracts/${c.id}`)}
              className="flex items-center gap-3 h-14 px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 cursor-pointer transition-colors"
            >
              <FileSignature size={16} className="text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-[14px] font-medium text-gray-900 truncate">{c.title}</span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_BADGE[c.status]}`}>
                {c.status}
              </span>
              <span className="text-[12px] text-gray-400 flex-shrink-0">
                {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
