'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Save, Send, ArrowLeft, FileSignature, Settings, X,
  Bold, Italic, Underline, List, ChevronDown, LayoutTemplate,
} from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { supabase } from '@/lib/supabase'
import type { CrmContract, ContractContent, CrmTemplate } from '@/types/crm'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractBuilderProps {
  contract:     CrmContract
  contactName:  string | null
  contactEmail: string | null
  onSave: (id: string, payload: Partial<CrmContract>) => Promise<void>
  onSend: (id: string, to: string) => Promise<void>
  onBack: () => void
}

interface PartyDetails {
  name:    string
  email:   string
  phone:   string
  address: string
  website: string
  tax_id:  string
}

interface CustomSection {
  id:    string
  title: string
  body:  string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const iField    = 'w-full bg-transparent border border-transparent rounded px-1 py-0.5 outline-none hover:border-gray-200 focus:border-gray-300 focus:bg-white/80 transition-all text-inherit placeholder-gray-300'
const iFieldSm  = 'bg-transparent border border-transparent rounded px-1 outline-none hover:border-gray-200 focus:border-gray-300 focus:bg-white/80 transition-all text-xs text-inherit'

const SECTION_TYPES = [
  'Confidentiality',
  'Non-Disclosure',
  'Governing Law',
  'Limitation of Liability',
  'Payment Terms',
  'Intellectual Property',
]

const SECTION_PLACEHOLDERS: Record<string, string> = {
  'Confidentiality':           'Both parties agree to keep all shared information strictly confidential and shall not disclose any proprietary information to third parties without prior written consent.',
  'Non-Disclosure':            'The receiving party agrees not to disclose, publish, or disseminate any confidential information received under this agreement to any third party for a period of two (2) years from the date of disclosure.',
  'Governing Law':             'This Agreement shall be governed by and construed in accordance with the laws of the applicable jurisdiction, without regard to its conflict of law provisions.',
  'Limitation of Liability':   'In no event shall either party be liable for any indirect, incidental, special, exemplary, or consequential damages arising out of or in connection with this Agreement.',
  'Payment Terms':             'All invoices are due within 14 days of receipt. Late payments will incur a fee of 1.5% per month on the outstanding balance.',
  'Intellectual Property':     'All intellectual property created under this Agreement shall remain the property of the service provider until full payment is received, at which point ownership transfers to the client.',
}

// ── execCommand wrapper ───────────────────────────────────────────────────────

function execCmd(cmd: string) {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  document.execCommand(cmd, false, undefined)
}

// ── ContractBuilder ───────────────────────────────────────────────────────────

export default function ContractBuilder({
  contract,
  contactName,
  contactEmail,
  onSave,
  onSend,
  onBack,
}: ContractBuilderProps) {
  const { settings } = useSettings()

  const content = contract.content as ContractContent

  // ── State ─────────────────────────────────────────────────────────────────

  const [title,         setTitle]         = useState(contract.title)
  const [effectiveDate, setEffectiveDate] = useState(content.effective_date ?? '')
  const [expiryDate,    setExpiryDate]    = useState(content.expiry_date ?? '')
  const [sigNotes,      setSigNotes]      = useState(content.signature_block ?? '')
  const [notes,         setNotes]         = useState('')

  const [fromDetails, setFromDetails] = useState<PartyDetails>({
    name:    settings.company_name      || '',
    email:   settings.business_email   || '',
    phone:   settings.business_phone   || '',
    address: settings.business_address || '',
    website: settings.business_website || '',
    tax_id:  settings.tax_id           || '',
  })

  const [toDetails, setToDetails] = useState<PartyDetails>({
    name:    contactName  ?? '',
    email:   contactEmail ?? '',
    phone:   '',
    address: '',
    website: '',
    tax_id:  '',
  })

  const [customSections,  setCustomSections]  = useState<CustomSection[]>([])
  const [activeSecId,     setActiveSecId]     = useState<string | null>(null)

  const [saving,           setSaving]           = useState(false)
  const [saveMsg,          setSaveMsg]          = useState('')
  const [saveDropOpen,     setSaveDropOpen]     = useState(false)
  const [sending,          setSending]          = useState(false)
  const [sendEmail,        setSendEmail]        = useState(contactEmail ?? '')
  const [showSendModal,    setShowSendModal]    = useState(false)
  const [showSettings,     setShowSettings]     = useState(false)
  const [toast,            setToast]            = useState<string | null>(null)
  const [savingTemplate,   setSavingTemplate]   = useState(false)
  const [showTemplatePick, setShowTemplatePick] = useState(false)
  const [templates,        setTemplates]        = useState<CrmTemplate[] | null>(null)

  const bodyRef = useRef<HTMLDivElement>(null)

  const accent = settings.accent_color || '#ED64A6'
  const logo   = settings.logo

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Template handlers ─────────────────────────────────────────────────────

  const handleSaveTemplate = useCallback(async () => {
    setSavingTemplate(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const bodyHtml = bodyRef.current?.innerHTML ?? ''
      const { error } = await supabase.from('crm_templates').insert({
        user_id: session.user.id,
        type:    'contract',
        title:   title || 'Untitled Contract',
        content: { title, body_html: bodyHtml, customSections },
      })
      if (!error) showToast('Saved as template')
    } finally {
      setSavingTemplate(false)
    }
  }, [title, customSections, showToast])

  const openTemplatePicker = useCallback(async () => {
    setShowTemplatePick(true)
    if (templates !== null) return
    const { data } = await supabase
      .from('crm_templates')
      .select('*')
      .eq('type', 'contract')
      .order('created_at', { ascending: false })
    setTemplates((data as CrmTemplate[]) ?? [])
  }, [templates])

  const applyTemplate = useCallback((t: CrmTemplate) => {
    const c = t.content as { title?: string; body_html?: string; customSections?: CustomSection[] }
    if (c.title) setTitle(c.title)
    if (c.body_html && bodyRef.current) bodyRef.current.innerHTML = c.body_html
    if (c.customSections) setCustomSections(c.customSections.map((s) => ({ ...s, id: uid() })))
    setShowTemplatePick(false)
    showToast('Template applied')
  }, [showToast])

  // ── Build save payload ────────────────────────────────────────────────────

  const buildPayload = useCallback(() => ({
    title,
    content: {
      body:            bodyRef.current?.innerText ?? '',
      body_html:       bodyRef.current?.innerHTML ?? '',
      effective_date:  effectiveDate || null,
      expiry_date:     expiryDate    || null,
      signature_block: sigNotes,
    },
  }), [title, effectiveDate, expiryDate, sigNotes])

  // ── Save ──────────────────────────────────────────────────────────────────

  const doSave = useCallback(async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await onSave(contract.id, buildPayload())
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }, [contract.id, buildPayload, onSave])

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!sendEmail) return
    setSending(true)
    try {
      await onSave(contract.id, buildPayload())   // save first
      await onSend(contract.id, sendEmail)
      setShowSendModal(false)
      showToast('Contract sent')
    } finally {
      setSending(false)
    }
  }, [contract.id, sendEmail, buildPayload, onSave, onSend, showToast])

  // ── Custom sections ───────────────────────────────────────────────────────

  const addSection = (title: string) => {
    if (customSections.find((s) => s.title === title)) return
    const sec: CustomSection = { id: uid(), title, body: SECTION_PLACEHOLDERS[title] ?? '' }
    setCustomSections((prev) => [...prev, sec])
    setActiveSecId(sec.id)
  }

  const updateSection = (id: string, field: 'title' | 'body', value: string) => {
    setCustomSections((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s))
  }

  const removeSection = (id: string) => {
    setCustomSections((prev) => prev.filter((s) => s.id !== id))
    if (activeSecId === id) setActiveSecId(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">

      {/* ── Top nav (mirrors invoice editor) ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2 mr-auto">
          <FileSignature size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">Contract</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ml-1 ${
            contract.status === 'signed'   ? 'bg-emerald-100 text-emerald-700' :
            contract.status === 'sent'     ? 'bg-blue-100 text-blue-700'       :
            contract.status === 'declined' ? 'bg-red-100 text-red-700'         :
                                             'bg-gray-100 text-gray-600'
          }`}>{contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}</span>
        </div>

        {saveMsg && <span className="text-xs text-gray-500">{saveMsg}</span>}

        {/* Rich text format buttons */}
        <div className="hidden md:flex items-center gap-0.5 border-r border-gray-100 pr-3">
          {([
            { icon: Bold,      cmd: 'bold',                title: 'Bold' },
            { icon: Italic,    cmd: 'italic',              title: 'Italic' },
            { icon: Underline, cmd: 'underline',           title: 'Underline' },
            { icon: List,      cmd: 'insertUnorderedList', title: 'Bullet list' },
          ] as const).map(({ icon: Icon, cmd, title: t }) => (
            <button
              key={cmd}
              type="button"
              title={t}
              onMouseDown={(e) => { e.preventDefault(); execCmd(cmd) }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        {/* Template buttons */}
        <button
          onClick={() => void openTemplatePicker()}
          className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          title="Use a saved template"
        >
          <LayoutTemplate size={14} />
          Templates
        </button>
        <button
          onClick={() => void handleSaveTemplate()}
          disabled={savingTemplate}
          className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          title="Save as template"
        >
          <LayoutTemplate size={14} />
          {savingTemplate ? 'Saved!' : 'Save as template'}
        </button>

        {/* Save dropdown */}
        <div className="relative flex">
          <button
            onClick={() => void doSave()}
            disabled={saving}
            className="px-3 py-2 rounded-l-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save size={14} />{saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setSaveDropOpen((o) => !o)}
            className="px-2 py-2 rounded-r-xl text-sm font-medium border border-l-0 border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronDown size={14} />
          </button>
          {saveDropOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSaveDropOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-200 z-20 overflow-hidden shadow-lg">
                {(['draft', 'sent', 'signed', 'declined'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      void onSave(contract.id, { ...buildPayload(), status: s })
                      setSaveDropOpen(false)
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors capitalize"
                  >
                    Mark as {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setShowSendModal(true)}
          disabled={contract.status === 'signed'}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: accent }}
        >
          <Send size={14} />Send
        </button>

        <button
          onClick={() => setShowSettings((o) => !o)}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          title="Contract settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* ── Settings panel (floating, right-aligned) ── */}
      {showSettings && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} />
          <div className="fixed right-4 top-16 w-72 bg-white rounded-2xl border border-gray-200 z-40 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Contract Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={14} />
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Effective Date</p>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Expiry Date</p>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Signature Notes</p>
              <textarea
                rows={3}
                value={sigNotes}
                onChange={(e) => setSigNotes(e.target.value)}
                placeholder="e.g. Witness required"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 resize-none"
              />
            </div>
            {contract.signed_at && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-emerald-700">Signed</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {new Date(contract.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Document canvas ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-2xl rounded-2xl p-8 md:p-12 bg-white text-gray-900 shadow-xl">

          {/* Document header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              {logo
                ? <img src={logo} alt="Logo" className="object-contain rounded-xl mb-2" style={{ height: 60, maxWidth: 140 }} />
                : (
                  <div
                    className="w-12 h-12 rounded-xl mb-2 flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: accent }}
                  >
                    {(fromDetails.name || 'C').slice(0, 1).toUpperCase()}
                  </div>
                )
              }
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Contract</p>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-bold text-xl text-right w-52 bg-transparent border-none outline-none hover:bg-black/5 rounded placeholder-gray-300"
                placeholder="Contract Title"
              />
            </div>
          </div>

          {/* From / To */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">From</p>
              {(['name', 'email', 'phone', 'address', 'website', 'tax_id'] as const).map((field) => (
                <input
                  key={field}
                  value={fromDetails[field]}
                  onChange={(e) => setFromDetails((f) => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === 'tax_id' ? 'Tax ID' : field.charAt(0).toUpperCase() + field.slice(1)}
                  className={`${iField} text-sm mb-0.5`}
                />
              ))}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">To</p>
              {(['name', 'email', 'phone', 'address', 'website', 'tax_id'] as const).map((field) => (
                <input
                  key={field}
                  value={toDetails[field]}
                  onChange={(e) => setToDetails((f) => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === 'tax_id' ? 'Tax ID' : field.charAt(0).toUpperCase() + field.slice(1)}
                  className={`${iField} text-sm mb-0.5`}
                />
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-4 mb-6 text-sm">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 mr-2">Effective Date</span>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className={iFieldSm}
              />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 mr-2">Expiry Date</span>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={iFieldSm}
              />
            </div>
          </div>

          {/* Body — rich text */}
          <div className="mb-6">
            <div className="border-t border-b border-gray-100 py-2 mb-4" />
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Write the contract body here…"
              className="min-h-[240px] text-sm text-gray-800 leading-relaxed focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: content.body_html || '' }}
            />
          </div>

          {/* Notes */}
          <div className="border-t border-gray-100 pt-5 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes…"
              rows={3}
              className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-300 outline-none resize-none"
            />
          </div>

          {/* Custom sections */}
          {customSections.map((sec) => (
            <div key={sec.id} className="border-t border-gray-100 pt-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <input
                  value={sec.title}
                  onChange={(e) => updateSection(sec.id, 'title', e.target.value)}
                  className="text-[10px] font-bold uppercase tracking-widest opacity-40 bg-transparent border-none outline-none hover:opacity-60 w-full"
                />
                <button
                  onClick={() => removeSection(sec.id)}
                  className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 ml-2"
                >
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={sec.body}
                onChange={(e) => updateSection(sec.id, 'body', e.target.value)}
                onClick={() => setActiveSecId(sec.id)}
                rows={activeSecId === sec.id ? 6 : 3}
                className="w-full text-sm text-gray-700 bg-transparent outline-none resize-none leading-relaxed transition-all"
              />
            </div>
          ))}

          {/* Add section buttons */}
          <div className="border-t border-gray-100 pt-5 mb-6 flex flex-wrap gap-2">
            {SECTION_TYPES.filter((t) => !customSections.find((s) => s.title === t)).map((t) => (
              <button
                key={t}
                onClick={() => addSection(t)}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                + {t}
              </button>
            ))}
          </div>

          {/* Signature block */}
          <div className="border-t border-gray-100 pt-5">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">Signed by Provider</p>
                <div className="h-10 border-b border-gray-200" />
                <p className="text-xs text-gray-400 mt-1">{fromDetails.name || 'Provider'}</p>
                <p className="text-xs text-gray-300 mt-0.5">Date: ___________</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">Signed by Client</p>
                {contract.status === 'signed' ? (
                  <>
                    <div className="h-10 border-b border-emerald-300 flex items-end pb-1">
                      <span className="text-sm italic text-emerald-700">{toDetails.name || 'Client'}</span>
                    </div>
                    <p className="text-xs text-emerald-600 mt-1">
                      Signed {contract.signed_at
                        ? new Date(contract.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                        : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-10 border-b border-gray-200" />
                    <p className="text-xs text-gray-400 mt-1">{toDetails.name || 'Client'}</p>
                    <p className="text-xs text-gray-300 mt-0.5">Date: ___________</p>
                  </>
                )}
              </div>
            </div>
            {sigNotes && (
              <p className="text-xs text-gray-400 mt-4 whitespace-pre-wrap">{sigNotes}</p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 mt-8 pt-4 flex items-center justify-between">
            <p className="text-[10px] opacity-30">Created with Fey</p>
          </div>
        </div>
      </div>

      {/* ── Template picker modal ── */}
      {showTemplatePick && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowTemplatePick(false)}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Use a template</h3>
              <button onClick={() => setShowTemplatePick(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={15} />
              </button>
            </div>
            {templates === null ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <LayoutTemplate size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No contract templates yet.</p>
                <p className="text-xs text-gray-400 mt-1">Save a contract as a template to reuse it here.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Send modal ── */}
      {showSendModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowSendModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-1">Send Contract</h3>
            <p className="text-sm text-gray-500 mb-4">
              The client will receive a link to view and sign this contract.
            </p>
            <input
              type="email"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSendModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSend()}
                disabled={sending || !sendEmail}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: accent }}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
