'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2, Check } from 'lucide-react'
import { uploadToCloudinary, validateUploadFile } from '@/utils/cloudinary'
import {
  VAULT_CATEGORIES, VAULT_CATEGORY_LABEL,
  VAULT_VISIBILITIES, VAULT_VISIBILITY_LABEL, VAULT_VISIBILITY_DESCRIPTION,
  type CreateVaultItemPayload, type VaultCategory, type VaultVisibility,
} from '@/types/vault'

/**
 * Adding a document to the Vault.
 *
 * The file is uploaded to Cloudinary from the browser first, then the metadata
 * is recorded — the same two-step every other upload in the app uses. Details
 * are asked for before the upload starts, so a slow file doesn't leave someone
 * staring at a spinner with a form still to fill in afterwards.
 *
 * Visibility defaults to private. Sharing should be a decision someone makes,
 * not something that happens because they didn't read the form.
 */

interface VaultUploadProps {
  accent: string
  clients: { id: string; name: string }[]
  onSave: (payload: CreateVaultItemPayload) => Promise<void>
  onCancel: () => void
}

export default function VaultUpload({ accent, clients, onSave, onCancel }: VaultUploadProps) {
  const fileInput = useRef<HTMLInputElement>(null)

  const [file, setFile]           = useState<File | null>(null)
  const [title, setTitle]         = useState('')
  const [category, setCategory]   = useState<VaultCategory>('other')
  const [visibility, setVisibility] = useState<VaultVisibility>('private')
  const [contactId, setContactId] = useState('')
  const [progress, setProgress]   = useState<number | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const pick = (f: File | null) => {
    if (!f) return
    const invalid = validateUploadFile(f)
    if (invalid) { setError(invalid); return }
    setError('')
    setFile(f)
    // Seed the title from the filename minus its extension — almost always
    // what they'd have typed, and still editable.
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  const save = async () => {
    if (!file || !title.trim()) return
    if (visibility === 'client' && !contactId) {
      setError('Choose which client should see this.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { promise } = uploadToCloudinary(file, 'vault', setProgress)
      const uploaded = await promise
      await onSave({
        title:         title.trim(),
        category,
        file_name:     file.name,
        file_url:      uploaded.url,
        public_id:     uploaded.publicId,
        file_size:     uploaded.size,
        file_type:     file.type || null,
        resource_type: uploaded.resourceType,
        visibility,
        contact_id:    visibility === 'client' ? contactId : null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That file couldn’t be saved.')
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xs font-semibold uppercase tracking-widest text-gray-300">Add a document</span>
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-300 hover:text-gray-500"
        >
          <X size={15} />
        </button>
      </div>

      {/* File */}
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="w-full flex items-center gap-3 px-3 py-3 min-h-[56px] rounded-xl border border-dashed border-gray-200 hover:border-gray-300 text-left transition-colors"
      >
        <span
          aria-hidden
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accent}12`, color: accent }}
        >
          {file ? <Check size={16} /> : <Upload size={16} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-gray-700 truncate">
            {file ? file.name : 'Choose a file'}
          </span>
          <span className="block text-2xs text-gray-400">
            {file ? 'Tap to pick a different one' : 'PDFs, images, documents and more'}
          </span>
        </span>
      </button>

      <div className="space-y-2 mt-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is it?"
          aria-label="Document name"
          className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
        />

        <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 pt-1">Category</span>
        <div className="flex flex-wrap gap-1.5">
          {VAULT_CATEGORIES.map((c) => {
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className="px-3 min-h-[44px] rounded-xl text-xs font-medium border transition-colors"
                style={active
                  ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
                  : { borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                {VAULT_CATEGORY_LABEL[c]}
              </button>
            )
          })}
        </div>

        <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 pt-2">
          Who can see it
        </span>
        <div className="flex flex-wrap gap-1.5">
          {VAULT_VISIBILITIES.map((v) => {
            const active = visibility === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className="px-3 min-h-[44px] rounded-xl text-xs font-medium border transition-colors"
                style={active
                  ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
                  : { borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                {VAULT_VISIBILITY_LABEL[v]}
              </button>
            )
          })}
        </div>
        <p className="text-2xs text-gray-400 leading-relaxed">{VAULT_VISIBILITY_DESCRIPTION[visibility]}</p>

        {visibility === 'client' && (
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            aria-label="Which client"
            className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
          >
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p className="text-2xs mt-3" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      {progress !== null && (
        <div className="mt-3 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{ width: `${progress}%`, backgroundColor: accent }}
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-3 py-2.5 min-h-[44px] rounded-full text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={() => void save()}
          disabled={!file || !title.trim() || saving}
          className="press inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-white text-xs font-semibold disabled:opacity-40"
          style={{ backgroundColor: accent }}
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Save to Vault
        </button>
      </div>
    </div>
  )
}
