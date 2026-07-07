'use client'

import { use, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, Plus, X, Loader2 } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import DateField from '@/components/ui/DateField'
import { useWorkspace } from '@/hooks/useWorkspace'
import { formatDate } from '@/utils/formatDate'
import type { ProjectStatus } from '@/types/project'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
}

const STATUS_STYLE: Record<ProjectStatus, string> = {
  active: 'bg-green-50 text-green-600',
  on_hold: 'bg-amber-50 text-amber-600',
  completed: 'bg-blue-50 text-blue-600',
  archived: 'bg-gray-100 text-gray-500',
}

export default function ProjectsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { canManage } = useWorkspace()
  const { projects, loading, createProject } = useProjects(id)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      })
      setShowForm(false)
      setTitle(''); setDescription(''); setDueDate('')
      router.push(`/projects/${project.id}`)
    } catch {
      setError('Couldn’t create the brand. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [title, description, dueDate, id, createProject, router])

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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen size={28} className="text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No brands yet</p>
          <p className="text-xs text-gray-400">Create a brand to keep its chat and files together.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{p.title}</h3>
                <span className={`flex-shrink-0 text-2xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              {p.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{p.description}</p>}
              <p className="text-2xs text-gray-400">
                {p.due_date ? `Due ${formatDate(p.due_date)}` : `Created ${formatDate(p.created_at)}`}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
