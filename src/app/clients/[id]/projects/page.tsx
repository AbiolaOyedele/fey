'use client'

import { use, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Plus, X, Loader2, ImagePlus } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import DateField from '@/components/ui/DateField'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useSettings } from '@/contexts/SettingsContext'
import BrandCard from '@/components/crm/BrandCard'
import BrandLogo from '@/components/crm/BrandLogo'
import { uploadToCloudinary, validateUploadFile } from '@/utils/cloudinary'

export default function ProjectsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { canManage } = useWorkspace()
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const { projects, loading, createProject } = useProjects(id)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [logo, setLogo] = useState<{ url: string; publicId: string } | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const logoInput = useRef<HTMLInputElement>(null)

  const pickLogo = useCallback(async (file: File | undefined) => {
    if (!file) return
    const problem = validateUploadFile(file)
    if (problem) { setError(problem); return }
    if (!file.type.startsWith('image/')) { setError('A logo needs to be an image.'); return }
    setUploadingLogo(true)
    setError('')
    try {
      const { url, publicId } = await uploadToCloudinary(file, 'brand-logos').promise
      setLogo({ url, publicId })
    } catch {
      setError('That logo couldn’t be uploaded. Please try again.')
    } finally {
      setUploadingLogo(false)
      if (logoInput.current) logoInput.current.value = ''
    }
  }, [])

  const visible = projects.filter((p) => !p.archived_at)

  const submit = useCallback(async () => {
    if (title.trim().length < 2) { setError('Give the brand a name.'); return }
    setSaving(true)
    setError('')
    try {
      const project = await createProject({
        contact_id: id,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        logo_url: logo?.url ?? null,
        logo_public_id: logo?.publicId ?? null,
      })
      setShowForm(false)
      setTitle(''); setDescription(''); setDueDate(''); setLogo(null)
      router.push(`/projects/${project.id}`)
    } catch {
      setError('Couldn’t create the brand. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [title, description, dueDate, logo, id, createProject, router])

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Brands</h2>
          <p className="text-sm text-gray-400">Each brand keeps its own chat and files in one place.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'New brand'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <BrandLogo
              name={title || '?'}
              logoUrl={logo?.url ?? null}
              accent={accent}
              className="w-14 h-14"
              rounded="rounded-2xl"
              textClassName="text-lg"
            />
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                disabled={uploadingLogo}
                className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {logo ? 'Replace logo' : 'Add logo'}
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="ml-1 h-11 px-2 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              )}
              <p className="text-2xs text-gray-400 mt-0.5">PNG or SVG on a transparent background looks best.</p>
            </div>
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pickLogo(e.target.files?.[0])}
            />
          </div>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError('') }}
            placeholder="Brand name"
            className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 mb-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
            className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 resize-none mb-2"
          />
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-gray-500">Due date</label>
            <DateField
              value={dueDate || null}
              onChange={(v) => setDueDate(v ?? '')}
              className="px-3! py-2! rounded-xl!"
            />
          </div>
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="flex justify-end">
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create brand
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-4xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles size={28} className="text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No brands yet</p>
          <p className="text-xs text-gray-400">Create a brand to keep its chat and files together.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-4xl">
          {visible.map((p) => (
            <BrandCard
              key={p.id}
              project={p}
              accent={accent}
              onOpen={() => router.push(`/projects/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
