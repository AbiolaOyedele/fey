'use client'
import { portalTokenKey } from '@/hooks/usePortalAuth'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardList, CheckCircle2 } from 'lucide-react'
import type { CrmForm, FormField, FormResponse } from '@/types/crm'
import { Checkbox } from '@/components/ui/checkbox'
import DateField from '@/components/ui/DateField'

function FormFieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const base = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors'
  switch (field.type) {
    case 'title':
      return null
    case 'text':
      return <input type="text" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ''} className={base} />
    case 'email':
      return <input type="email" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? 'email@example.com'} className={base} />
    case 'phone':
      return <input type="tel" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? '+1 000 000 0000'} className={base} />
    case 'textarea':
      return <textarea rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ''} className={`${base} resize-none`} />
    case 'select':
      return (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">{field.placeholder ?? 'Select an option…'}</option>
          {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )
    case 'multiselect': {
      const selected = (value as string[]) ?? []
      return (
        <div className="space-y-2">
          {field.options.map((opt) => (
            <Checkbox
              key={opt}
              checked={selected.includes(opt)}
              label={opt}
              onCheckedChange={(next) => {
                onChange(next ? [...selected, opt] : selected.filter((o) => o !== opt))
              }}
            />
          ))}
        </div>
      )
    }
    case 'date':
      return (
        <DateField
          value={(value as string) || null}
          onChange={(v) => onChange(v ?? '')}
          placeholder={field.placeholder ?? 'Pick a date'}
          className="w-full px-3! py-2.5! rounded-xl! bg-gray-50! focus-within:bg-white!"
        />
      )
    case 'file':
      return <p className="text-sm text-gray-400 italic">File upload not supported in portal.</p>
  }
}

export default function PortalFormDetailPage({
  params,
}: {
  params: Promise<{ subdomain: string; formId: string }>
}) {
  const { subdomain, formId } = use(params)
  const router = useRouter()

  const [form,      setForm]      = useState<CrmForm | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [answers,   setAnswers]   = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [token,     setToken]     = useState('')
  const [toast,     setToast]     = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    void (async () => {
      const portalToken = localStorage.getItem(portalTokenKey(subdomain))
      if (!portalToken) { setLoading(false); return }
      setToken(portalToken)
      const res = await fetch('/api/v1/portal/forms', {
        headers: { Authorization: `Bearer ${portalToken}` },
      })
      if (res.ok) {
        const d = await res.json() as { forms: CrmForm[] }
        const found = d.forms.find((f) => f.id === formId) ?? null
        setForm(found)
        if (found?.status === 'submitted') setSubmitted(true)
      }
      setLoading(false)
    })()
  }, [subdomain, formId])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !token) return

    // Validate required fields
    for (const field of form.fields) {
      if (field.required) {
        const val = answers[field.id]
        if (val === undefined || val === null || val === '' || val === false) {
          showToast(`"${field.label}" is required.`)
          return
        }
      }
    }

    const responses: FormResponse[] = form.fields.map((field) => ({
      field_id: field.id,
      value:    answers[field.id] ?? null,
    }))

    setSubmitting(true)
    const res = await fetch(`/api/v1/portal/forms/${formId}/submit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ responses }),
    })
    if (res.ok || res.status === 204) {
      setSubmitted(true)
    } else {
      showToast('Failed to submit. Please try again.')
    }
    setSubmitting(false)
  }, [form, token, answers, formId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <p className="text-gray-400">Form not found.</p>
          <button onClick={() => router.back()} className="text-sm mt-2 underline text-gray-500">Go back</button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft size={15} />
          Back to forms
        </button>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Form submitted</h2>
          <p className="text-sm text-gray-500">Your response has been recorded. Thank you!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft size={15} />
        Back to forms
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <ClipboardList size={20} className="text-gray-400" />
          <h1 className="text-xl font-bold text-gray-900">{form.title}</h1>
        </div>

        {form.fields.length === 0 ? (
          <p className="text-sm text-gray-400 italic">This form has no fields yet.</p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            {form.fields.map((field) => (
              <div key={field.id}>
                {field.type === 'title' ? (
                  <h3 className="text-base font-bold text-gray-900 pt-2 border-b border-gray-100 pb-2">{field.label}</h3>
                ) : (
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                )}
                <FormFieldInput
                  field={field}
                  value={answers[field.id]}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [field.id]: v }))}
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 mt-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#101010' }}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </form>
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
