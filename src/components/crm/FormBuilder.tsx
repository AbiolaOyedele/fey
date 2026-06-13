'use client'

import { useState, useCallback, useId, useRef, useEffect } from 'react'
import {
  ArrowLeft, Save, Send, Plus, Trash2, GripVertical,
  ChevronDown, Type, AlignLeft, List, CheckSquare, Calendar,
  FileUp, Mail, Phone, LayoutTemplate, X, Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CrmForm, FormField, FormFieldType, UpdateFormPayload, CrmTemplate } from '@/types/crm'

// ── Field catalogue ───────────────────────────────────────────────────────────

interface FieldDef {
  type:  FormFieldType
  label: string
  icon:  React.ReactNode
}

const FIELD_CATALOGUE: FieldDef[] = [
  { type: 'title',       label: 'Title card',    icon: <Type       size={16} /> },
  { type: 'text',        label: 'Short answer',  icon: <AlignLeft  size={16} /> },
  { type: 'textarea',    label: 'Long answer',   icon: <List       size={16} /> },
  { type: 'multiselect', label: 'Multi select',  icon: <CheckSquare size={16} /> },
  { type: 'select',      label: 'Single select', icon: <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-current" /></span> },
  { type: 'file',        label: 'File upload',   icon: <FileUp     size={16} /> },
  { type: 'date',        label: 'Date',          icon: <Calendar   size={16} /> },
  { type: 'email',       label: 'Email',         icon: <Mail       size={16} /> },
  { type: 'phone',       label: 'Phone number',  icon: <Phone      size={16} /> },
]

const FIELD_MAP = Object.fromEntries(FIELD_CATALOGUE.map((f) => [f.type, f])) as Record<FormFieldType, FieldDef>

// ── Field preview (live preview panel) ───────────────────────────────────────

function FieldPreview({ field }: { field: FormField }) {
  if (field.type === 'title') return (
    <div className="pt-2 pb-1 border-b border-gray-200">
      <p className="text-base font-bold text-gray-900">{field.label || 'Section title'}</p>
    </div>
  )

  const labelEl = (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {field.label || 'Untitled field'}
      {field.required && <span className="text-red-400 ml-1">*</span>}
    </label>
  )

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
      return (
        <div>
          {labelEl}
          <input readOnly placeholder={field.placeholder ?? ''} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 placeholder-gray-400" />
        </div>
      )
    case 'textarea':
      return (
        <div>
          {labelEl}
          <textarea readOnly rows={3} placeholder={field.placeholder ?? ''} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 placeholder-gray-400 resize-none" />
        </div>
      )
    case 'select':
      return (
        <div>
          {labelEl}
          <div className="relative">
            <select disabled className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400 appearance-none">
              <option>{field.placeholder ?? 'Select an option…'}</option>
              {field.options.map((o) => <option key={o}>{o}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )
    case 'multiselect':
      return (
        <div>
          {labelEl}
          <div className="space-y-1.5">
            {field.options.length === 0
              ? <p className="text-xs text-gray-400">Add options below</p>
              : field.options.map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" readOnly className="rounded" /> {o}
                  </label>
                ))
            }
          </div>
        </div>
      )
    case 'date':
      return (
        <div>
          {labelEl}
          <input readOnly type="date" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50" />
        </div>
      )
    case 'file':
      return (
        <div>
          {labelEl}
          <div className="w-full px-3 py-5 border-2 border-dashed border-gray-200 rounded-xl text-center text-sm text-gray-400">
            Click to upload a file
          </div>
        </div>
      )
  }
}

// ── Field editor (left panel) ─────────────────────────────────────────────────

function FieldEditor({ field, onUpdate, onDelete }: {
  field:    FormField
  onUpdate: (f: FormField) => void
  onDelete: () => void
}) {
  const [optInput, setOptInput] = useState('')

  const addOption = () => {
    const v = optInput.trim()
    if (!v || field.options.includes(v)) return
    onUpdate({ ...field, options: [...field.options, v] })
    setOptInput('')
  }

  const def = FIELD_MAP[field.type]
  const hasOptions   = field.type === 'select' || field.type === 'multiselect'
  const hasPlaceholder = !['title', 'date', 'file', 'multiselect'].includes(field.type)
  const isTitle      = field.type === 'title'

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
      {/* Row header */}
      <div className="flex items-center gap-2">
        <GripVertical size={15} className="text-gray-300 flex-shrink-0 cursor-grab" />
        <span className="text-gray-400 flex-shrink-0">{def.icon}</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{def.label}</span>
        <div className="flex-1" />
        <button type="button" onClick={onDelete} className="text-gray-300 hover:text-red-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Label */}
      <div className={hasPlaceholder ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <label className="block text-2xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            {isTitle ? 'Heading text' : 'Label'}
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ ...field, label: e.target.value })}
            placeholder={isTitle ? 'Section heading…' : 'Field label'}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
          />
        </div>
        {hasPlaceholder && (
          <div>
            <label className="block text-2xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Placeholder</label>
            <input
              type="text"
              value={field.placeholder ?? ''}
              onChange={(e) => onUpdate({ ...field, placeholder: e.target.value || null })}
              placeholder="Placeholder text"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
          </div>
        )}
      </div>

      {/* Required toggle */}
      {!isTitle && (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate({ ...field, required: e.target.checked })}
            className="rounded"
          />
          Required
        </label>
      )}

      {/* Options (select / multiselect) */}
      {hasOptions && (
        <div>
          <label className="block text-2xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Options</label>
          <div className="space-y-1.5 mb-2">
            {field.options.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-700 px-3 py-1.5 bg-gray-50 rounded-lg">{opt}</span>
                <button
                  type="button"
                  onClick={() => onUpdate({ ...field, options: field.options.filter((o) => o !== opt) })}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={optInput}
              onChange={(e) => setOptInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
              placeholder="Add option…"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={addOption}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Live preview ──────────────────────────────────────────────────────────────

function LivePreview({ title, fields }: { title: string; fields: FormField[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">{title || 'Untitled Form'}</h2>
      {fields.length === 0
        ? <p className="text-sm text-gray-400 text-center py-6">Add fields to see the preview</p>
        : fields.map((f) => <FieldPreview key={f.id} field={f} />)
      }
      {fields.length > 0 && (
        <button type="button" disabled className="w-full py-2.5 rounded-full text-sm font-semibold text-white opacity-70" style={{ backgroundColor: 'var(--accent, #ED64A6)' }}>
          Submit
        </button>
      )}
    </div>
  )
}

// ── Add-field dropdown ────────────────────────────────────────────────────────

function AddFieldDropdown({ onAdd }: { onAdd: (type: FormFieldType) => void }) {
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-white transition-colors w-full"
      >
        <Plus size={15} />
        Add field
        <ChevronDown size={13} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-2xl border border-gray-200 z-20 overflow-hidden py-1 shadow-lg">
          {FIELD_CATALOGUE.map((def, i) => {
            const isGroupBreak = i === 1 || i === 3 || i === 5
            return (
              <div key={def.type}>
                {isGroupBreak && <div className="my-1 border-t border-gray-100" />}
                <button
                  type="button"
                  onClick={() => { onAdd(def.type); setOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-500 flex-shrink-0">{def.icon}</span>
                  {def.label}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Template picker modal ─────────────────────────────────────────────────────

function TemplatePicker({ onSelect, onClose }: {
  onSelect: (t: CrmTemplate) => void
  onClose:  () => void
}) {
  const [templates, setTemplates] = useState<CrmTemplate[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('crm_templates')
        .select('*')
        .eq('type', 'form')
        .order('created_at', { ascending: false })
      setTemplates((data as CrmTemplate[]) ?? [])
      setLoading(false)
    })()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Use a template</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8">
            <LayoutTemplate size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No form templates yet.</p>
            <p className="text-xs text-gray-400 mt-1">Save a form as a template to reuse it here.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{t.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {((t.content.fields as FormField[]) ?? []).length} fields · {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── FormBuilder ───────────────────────────────────────────────────────────────

interface FormBuilderProps {
  form:         CrmForm
  contactEmail: string | null
  onSave:  (id: string, payload: UpdateFormPayload) => Promise<void>
  onSend:  (id: string, to: string) => Promise<void>
  /** When true, hides all edit/save/send controls (members get view-only). */
  readOnly?: boolean
  onBack:  () => void
}

export default function FormBuilder({ form, contactEmail, onSave, onSend, onBack, readOnly = false }: FormBuilderProps) {
  const uid     = useId()
  const makeId  = useCallback(() => `${uid}-${Math.random().toString(36).slice(2, 8)}`, [uid])

  const [title,            setTitle]            = useState(form.title)
  const [fields,           setFields]           = useState<FormField[]>(form.fields)
  const [saving,           setSaving]           = useState(false)
  const [sending,          setSending]          = useState(false)
  const [showSendModal,    setShowSendModal]     = useState(false)
  const [showTemplatePick, setShowTemplatePick]  = useState(false)
  const [sendEmail,        setSendEmail]         = useState(contactEmail ?? '')
  const [toast,            setToast]             = useState<string | null>(null)
  const [savingTemplate,   setSavingTemplate]    = useState(false)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Field ops ─────────────────────────────────────────────────────────────

  const addField = useCallback((type: FormFieldType) => {
    const def = FIELD_MAP[type]
    setFields((prev) => [...prev, {
      id:          makeId(),
      type,
      label:       def.label,
      placeholder: null,
      required:    false,
      options:     [],
    }])
  }, [makeId])

  const updateField = useCallback((id: string, updated: FormField) => {
    setFields((prev) => prev.map((f) => f.id === id ? updated : f))
  }, [])

  const deleteField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await onSave(form.id, { title, fields })
      showToast('Saved')
    } finally {
      setSaving(false)
    }
  }, [form.id, title, fields, onSave, showToast])

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!sendEmail) return
    setSending(true)
    try {
      await onSave(form.id, { title, fields })
      await onSend(form.id, sendEmail)
      setShowSendModal(false)
      showToast('Form sent')
    } finally {
      setSending(false)
    }
  }, [form.id, title, fields, sendEmail, onSave, onSend, showToast])

  // ── Save as template ──────────────────────────────────────────────────────

  const handleSaveTemplate = useCallback(async () => {
    setSavingTemplate(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { error } = await supabase.from('crm_templates').insert({
        user_id: session.user.id,
        type:    'form',
        title:   title || 'Untitled Form',
        content: { title, fields },
      })
      if (!error) showToast('Saved as template')
    } finally {
      setSavingTemplate(false)
    }
  }, [title, fields, showToast])

  // ── Apply template ────────────────────────────────────────────────────────

  const applyTemplate = useCallback((t: CrmTemplate) => {
    const content = t.content as { title?: string; fields?: FormField[] }
    if (content.title)  setTitle(content.title)
    if (content.fields) setFields(content.fields.map((f) => ({ ...f, id: makeId() })))
    setShowTemplatePick(false)
    showToast('Template applied')
  }, [makeId, showToast])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 text-base font-semibold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300"
          placeholder="Form title…"
        />
        {readOnly && <span className="text-xs text-gray-400">View only</span>}
        {!readOnly && (
        <div className="flex items-center gap-2">
          {/* Use template */}
          <button
            onClick={() => setShowTemplatePick(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            title="Use a saved template"
          >
            <LayoutTemplate size={14} />
            Templates
          </button>
          {/* Save as template */}
          <button
            onClick={() => void handleSaveTemplate()}
            disabled={savingTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            title="Save current form as a template"
          >
            {savingTemplate ? <Check size={14} className="text-emerald-500" /> : <LayoutTemplate size={14} />}
            {savingTemplate ? 'Saved!' : 'Save as template'}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            disabled={form.status === 'submitted'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            <Send size={14} />
            Send to Client
          </button>
        </div>
        )}
      </div>

      {/* Two-column body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: field editor */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">

          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
              <Plus size={24} className="mb-2 text-gray-200" />
              <p className="text-sm">Click &quot;Add field&quot; below to start building your form</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  onUpdate={(updated) => updateField(field.id, updated)}
                  onDelete={() => deleteField(field.id)}
                />
              ))}
            </div>
          )}

          {/* Add field dropdown */}
          <AddFieldDropdown onAdd={addField} />

          {/* Submitted responses */}
          {form.status === 'submitted' && form.responses.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Submitted Responses</h3>
              <div className="space-y-3">
                {form.responses.map((response) => {
                  const field = fields.find((f) => f.id === response.field_id)
                  return (
                    <div key={response.field_id}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{field?.label ?? response.field_id}</p>
                      <p className="text-sm text-gray-700 mt-0.5">{String(response.value)}</p>
                    </div>
                  )
                })}
              </div>
              {form.submitted_at && (
                <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                  Submitted {new Date(form.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: live preview */}
        <div className="w-[340px] flex-shrink-0 border-l border-gray-100 bg-gray-50/50 overflow-y-auto p-6">
          <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Live Preview</p>
          <LivePreview title={title} fields={fields} />
        </div>
      </div>

      {/* Template picker */}
      {showTemplatePick && (
        <TemplatePicker
          onSelect={applyTemplate}
          onClose={() => setShowTemplatePick(false)}
        />
      )}

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowSendModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-1">Send Form</h3>
            <p className="text-sm text-gray-500 mb-4">The client will receive a link to fill out this form.</p>
            <input
              type="email"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSendModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                onClick={() => void handleSend()}
                disabled={sending || !sendEmail}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
