'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileSignature } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CrmContract, ContractContent } from '@/types/crm'

export default function PortalContractDetailPage({
  params,
}: {
  params: Promise<{ subdomain: string; contractId: string }>
}) {
  const { subdomain: _subdomain, contractId } = use(params)
  const router = useRouter()

  const [contract,  setContract]  = useState<CrmContract | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [signing,   setSigning]   = useState(false)
  const [token,     setToken]     = useState('')
  const [toast,     setToast]     = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setToken(session.access_token)
      const res = await fetch('/api/v1/portal/contracts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const d = await res.json() as { contracts: CrmContract[] }
        setContract(d.contracts.find((c) => c.id === contractId) ?? null)
      }
      setLoading(false)
    })()
  }, [contractId])

  const sign = useCallback(async () => {
    if (!token || !contract || contract.status === 'signed') return
    setSigning(true)
    const res = await fetch(`/api/v1/portal/contracts/${contractId}/sign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setContract((prev) => prev ? { ...prev, status: 'signed', signed_at: new Date().toISOString() } : prev)
      showToast('Contract signed!')
    } else {
      showToast('Failed to sign. Please try again.')
    }
    setSigning(false)
  }, [token, contract, contractId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <p className="text-gray-400">Contract not found.</p>
          <button onClick={() => router.back()} className="text-sm mt-2 underline text-gray-500">Go back</button>
        </div>
      </div>
    )
  }

  const content = contract.content as ContractContent

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft size={15} />
        Back to contracts
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileSignature size={20} className="text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900">{contract.title}</h1>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${
            contract.status === 'signed'   ? 'bg-emerald-100 text-emerald-700' :
            contract.status === 'sent'     ? 'bg-blue-100 text-blue-700' :
            contract.status === 'declined' ? 'bg-red-100 text-red-600' :
                                             'bg-gray-100 text-gray-600'
          }`}>
            {contract.status}
          </span>
        </div>

        {content.body_html ? (
          <div
            className="prose prose-sm max-w-none text-gray-700 leading-relaxed mb-8"
            dangerouslySetInnerHTML={{ __html: content.body_html }}
          />
        ) : (
          <p className="text-gray-400 text-sm italic mb-8">No content yet.</p>
        )}

        {content.signature_block && (
          <div className="border-t border-gray-100 pt-6 mt-6">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Signature Block</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{content.signature_block}</p>
          </div>
        )}

        {contract.signed_at && (
          <div className="mt-6 bg-emerald-50 rounded-xl px-4 py-3">
            <p className="text-sm text-emerald-700 font-semibold">
              Signed on {new Date(contract.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}

        {contract.status === 'sent' && (
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => void sign()}
              disabled={signing}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#101010' }}
            >
              {signing ? 'Signing…' : 'Sign contract'}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm">
          {toast}
        </div>
      )}
    </div>
  )
}
