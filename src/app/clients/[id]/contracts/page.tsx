'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileSignature, LayoutTemplate, X, ChevronDown, LayoutGrid, List, CheckCircle2 } from 'lucide-react'
import { useContracts } from '@/hooks/useCrm'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useViewMode } from '@/hooks/useViewMode'
import { supabase } from '@/lib/supabase'
import type { CrmContract, ContractStatus, CrmTemplate, ContractContent } from '@/types/crm'

const STATUS_BADGE: Record<ContractStatus, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  signed:   'bg-emerald-100 text-emerald-700',
  declined: 'bg-red-100 text-red-600',
}

// ── View toggle ───────────────────────────────────────────────────────────────

function ViewToggle({ mode, onChange }: { mode: 'list' | 'grid'; onChange: (m: 'list' | 'grid') => void }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
      <button onClick={() => onChange('list')} title="List view" className={`p-1.5 rounded-md transition-colors ${mode === 'list' ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
        <List size={14} />
      </button>
      <button onClick={() => onChange('grid')} title="Grid view" className={`p-1.5 rounded-md transition-colors ${mode === 'grid' ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
        <LayoutGrid size={14} />
      </button>
    </div>
  )
}

// ── List row ──────────────────────────────────────────────────────────────────

function ContractRow({ contract, onClick }: { contract: CrmContract; onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center gap-3 h-14 px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 transition-colors cursor-pointer">
      <FileSignature size={16} className="text-gray-400 flex-shrink-0" />
      <span className="flex-1 text-sm font-medium text-gray-900 truncate">{contract.title}</span>
      <span className={`text-2xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_BADGE[contract.status]}`}>{contract.status}</span>
      <span className="text-xs text-gray-400 flex-shrink-0">
        {new Date(contract.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
    </div>
  )
}

// ── Grid card ─────────────────────────────────────────────────────────────────

function ContractCard({ contract, onClick }: { contract: CrmContract; onClick: () => void }) {
  return (
    <div onClick={onClick} className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
          <FileSignature size={16} className="text-gray-400" />
        </div>
        <span className={`text-3xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_BADGE[contract.status]}`}>{contract.status}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{contract.title}</p>
        <p className="text-2xs text-gray-400 mt-1">
          {new Date(contract.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      {contract.signed_at && (
        <div className="mt-auto pt-2 border-t border-gray-50">
          <p className="text-2xs text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle2 size={11} />
            Signed {new Date(contract.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Template picker modal ─────────────────────────────────────────────────────

function TemplatePickerModal({ onSelect, onClose }: {
  onSelect: (t: CrmTemplate) => Promise<void>
  onClose:  () => void
}) {
  const [templates, setTemplates] = useState<CrmTemplate[] | null>(null)
  const [applying,  setApplying]  = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('crm_templates').select('*').eq('type', 'contract').order('created_at', { ascending: false })
      setTemplates((data as CrmTemplate[]) ?? [])
    })()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Start from template</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>
        {templates === null ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8">
            <LayoutTemplate size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No contract templates saved yet.</p>
            <p className="text-xs text-gray-400 mt-1">Open a contract and click &ldquo;Save as template&rdquo;.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {templates.map((t) => (
              <button key={t.id} disabled={applying !== null} onClick={async () => { setApplying(t.id); await onSelect(t); setApplying(null) }} className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                <p className="text-sm font-medium text-gray-900">{applying === t.id ? 'Creating…' : t.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── New contract dropdown ─────────────────────────────────────────────────────

function NewContractDropdown({ onBlank, onFromTemplate }: { onBlank: () => void; onFromTemplate: () => void }) {
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <button onClick={onBlank} className="flex items-center gap-2 pl-4 pr-3 py-2 rounded-l-full text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: 'var(--accent, #ED64A6)' }}>
          <Plus size={14} /> New Contract
        </button>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center pr-3 pl-2 py-2 rounded-r-full text-white hover:opacity-90 border-l border-white/30 transition-opacity" style={{ backgroundColor: 'var(--accent, #ED64A6)' }} title="From template">
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 z-20 overflow-hidden py-1 shadow-lg">
          <button onClick={() => { setOpen(false); onBlank() }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <FileSignature size={14} className="text-gray-400" /> Blank contract
          </button>
          <button onClick={() => { setOpen(false); onFromTemplate() }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <LayoutTemplate size={14} className="text-gray-400" /> From template
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContractsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { contracts, loading, createContract, updateContract } = useContracts(id)
  const { canManage } = useWorkspace()
  const [mode, setMode] = useViewMode('contracts', 'list')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  const handleBlank = async () => {
    const contract = await createContract('New Contract')
    router.push(`/clients/${id}/contracts/${contract.id}`)
  }

  const handleFromTemplate = async (t: CrmTemplate) => {
    const content = t.content as { title?: string; body_html?: string }
    const contract = await createContract(content.title ?? t.title)
    if (content.body_html) {
      const newContent: Partial<ContractContent> = {
        body:      content.body_html.replace(/<[^>]+>/g, ''),
        body_html: content.body_html,
      }
      await updateContract(contract.id, { title: content.title ?? t.title, content: { ...contract.content, ...newContent } })
    }
    router.push(`/clients/${id}/contracts/${contract.id}`)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Contracts</h2>
          <p className="text-sm text-gray-400">{contracts.length} contract{contracts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle mode={mode} onChange={setMode} />
          {canManage && (
            <NewContractDropdown onBlank={() => void handleBlank()} onFromTemplate={() => setShowTemplatePicker(true)} />
          )}
        </div>
      </div>

      {loading ? (
        mode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
        )
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileSignature size={32} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500 mb-1">No contracts yet</p>
          {canManage && (
            <>
              <p className="text-xs2 text-gray-400">Create your first contract for this client.</p>
              <div className="flex gap-2 mt-5">
                <button onClick={() => void handleBlank()} className="px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: 'var(--accent, #ED64A6)' }}>
                  + Blank Contract
                </button>
                <button onClick={() => setShowTemplatePicker(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                  <LayoutTemplate size={14} /> From Template
                </button>
              </div>
            </>
          )}
        </div>
      ) : mode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {contracts.map((c) => (
            <ContractCard key={c.id} contract={c} onClick={() => router.push(`/clients/${id}/contracts/${c.id}`)} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {contracts.map((c) => (
            <ContractRow key={c.id} contract={c} onClick={() => router.push(`/clients/${id}/contracts/${c.id}`)} />
          ))}
        </div>
      )}

      {showTemplatePicker && (
        <TemplatePickerModal onSelect={handleFromTemplate} onClose={() => setShowTemplatePicker(false)} />
      )}
    </div>
  )
}
