'use client'

import { useState } from 'react'
import { X, Trash2, Link2 } from 'lucide-react'
import { SOCIAL_PASTEL_COLORS } from '@/types/social'
import type { SocialBrand } from '@/types/social'

interface BrandModalProps {
  /** null = creating a new brand. */
  brand: SocialBrand | null
  contacts: { id: string; name: string }[]
  accent: string
  onSave: (values: { name: string; color: string; contact_id: string | null }) => Promise<void>
  onDelete?: (() => Promise<void>) | undefined
  onClose: () => void
}

/** Create/edit a brand calendar space: name, pastel color, optional CRM client link. */
export default function BrandModal({ brand, contacts, accent, onSave, onDelete, onClose }: BrandModalProps) {
  const [name, setName] = useState(brand?.name ?? '')
  const [color, setColor] = useState(brand?.color ?? SOCIAL_PASTEL_COLORS[0])
  const [contactId, setContactId] = useState<string>(brand?.contact_id ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), color, contact_id: contactId || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full md:max-w-sm shadow-xl animate-slideUp max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg text-gray-800">{brand ? 'Edit brand' : 'New brand'}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
        </div>

        <label className="block text-xs font-medium text-gray-500 mb-1.5">Brand name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSave() }}
          placeholder="e.g. Doux"
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:border-gray-400 focus:bg-white outline-none transition-colors mb-4"
        />

        <label className="block text-xs font-medium text-gray-500 mb-1.5">Calendar color</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {SOCIAL_PASTEL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              className={`w-8 h-8 rounded-lg transition-transform ${color === c ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
          <Link2 size={12} /> Link to a client <span className="text-gray-300 font-normal">(optional)</span>
        </label>
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:border-gray-400 focus:bg-white outline-none transition-colors mb-6"
        >
          <option value="">No client — standalone brand</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          {brand && onDelete && (
            <button
              onClick={() => void onDelete()}
              title="Delete brand and its calendar"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={() => void handleSave()}
            disabled={!name.trim() || saving}
            className="flex-1 h-10 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {saving ? 'Saving…' : brand ? 'Save changes' : 'Create brand'}
          </button>
        </div>
      </div>
    </div>
  )
}
