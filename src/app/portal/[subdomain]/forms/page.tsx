'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CrmForm, FormStatus } from '@/types/crm'

const STATUS_BADGE: Record<FormStatus, string> = {
  draft:     'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  submitted: 'bg-emerald-100 text-emerald-700',
}

export default function PortalFormsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const router = useRouter()
  const [forms,   setForms]   = useState<CrmForm[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/v1/portal/forms', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const d = await res.json() as { forms: CrmForm[] }
        setForms(d.forms)
      }
      setLoading(false)
    })()
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
        <p className="text-sm text-gray-400 mt-0.5">{forms.length} form{forms.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList size={32} className="text-gray-200 mb-3" />
          <p className="text-[15px] font-medium text-gray-500">No forms yet</p>
          <p className="text-[13px] text-gray-400 mt-1">Forms sent to you will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {forms.map((f) => (
            <div
              key={f.id}
              onClick={() => router.push(`/portal/${subdomain}/forms/${f.id}`)}
              className="flex items-center gap-3 h-14 px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 cursor-pointer transition-colors"
            >
              <ClipboardList size={16} className="text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-[14px] font-medium text-gray-900 truncate">{f.title}</span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_BADGE[f.status]}`}>
                {f.status}
              </span>
              <span className="text-[12px] text-gray-400 flex-shrink-0">
                {new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
