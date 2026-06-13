'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useForms, useContacts } from '@/hooks/useCrm'
import { useWorkspace } from '@/hooks/useWorkspace'
import FormBuilder from '@/components/crm/FormBuilder'
import type { UpdateFormPayload } from '@/types/crm'

export default function FormDetailPage({ params }: { params: Promise<{ id: string; formId: string }> }) {
  const { id, formId } = use(params)
  const router = useRouter()
  const { contacts } = useContacts()
  const { forms, updateForm, sendForm } = useForms(id)
  const { canManage } = useWorkspace()

  const form    = forms.find((f) => f.id === formId)
  const contact = contacts.find((c) => c.id === id)

  if (!form) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-400 text-lg">Form not found.</p>
          <button
            onClick={() => router.push(`/clients/${id}/forms`)}
            className="text-sm mt-2 hover:underline"
            style={{ color: 'var(--accent, #ED64A6)' }}
          >
            Back to forms
          </button>
        </div>
      </div>
    )
  }

  return (
    <FormBuilder
      form={form}
      contactEmail={contact?.email ?? null}
      onSave={async (_id, payload: UpdateFormPayload) => { await updateForm(formId, payload) }}
      onSend={async (_id, to) => { await sendForm(formId, to) }}
      onBack={() => router.push(`/clients/${id}/forms`)}
      readOnly={!canManage}
    />
  )
}
