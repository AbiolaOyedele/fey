'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Loader2, FolderOpen, X, Archive, ArchiveRestore } from 'lucide-react'
import { useAllProjects } from '@/hooks/useProjects'
import { useContacts } from '@/hooks/useCrm'
import { useWorkspace } from '@/hooks/useWorkspace'
import type { Project } from '@/types/project'

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-green-50 text-green-600',
  on_hold:   'bg-amber-50 text-amber-600',
  completed: 'bg-blue-50 text-blue-600',
  archived:  'bg-gray-100 text-gray-500',
}

interface Group { key: string; label: string; projects: Project[] }

export default function ProjectsHubPage() {
  const router = useRouter()
  const { canManage } = useWorkspace()
  const { projects, archived, loading, error, createProject, restoreProject } = useAllProjects()
  const { contacts } = useContacts()

  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const nameFor = useMemo(() => {
    const m = new Map(contacts.map((c) => [c.id, c.name]))
    return (id: string | null) => (id ? m.get(id) ?? 'Client' : null)
  }, [contacts])

  const groups = useMemo<Group[]>(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? projects.filter((p) => p.title.toLowerCase().includes(q)) : projects
    const map = new Map<string, Group>()
    for (const p of filtered) {
      const key = p.contact_id ?? 'personal'
      const label = nameFor(p.contact_id) ?? 'Personal'
      if (!map.has(key)) map.set(key, { key, label, projects: [] })
      map.get(key)!.projects.push(p)
    }
    return [...map.values()].sort((a, b) => (a.key === 'personal' ? -1 : b.key === 'personal' ? 1 : a.label.localeCompare(b.label)))
  }, [projects, search, nameFor])

  return (
    <div className="p-4 lg:p-8 page-enter">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Projects</h1>
        {canManage && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-white rounded-full text-sm font-semibold hover:opacity-90"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            <Plus size={15} /> New project
          </button>
        )}
      </div>

      <div className="relative w-full sm:max-w-xs mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : error ? (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen size={30} strokeWidth={1.5} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">No projects yet</p>
          <p className="text-xs2 text-gray-400 mt-0.5">Create one — assign it to a client or keep it personal</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex items-baseline gap-2 px-1 mb-2">
                <h3 className="text-sm font-semibold text-gray-900">{g.label}</h3>
                <span className="text-xs2 text-gray-300">{g.projects.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{p.title}</h4>
                      <span className={`flex-shrink-0 text-2xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status] ?? STATUS_STYLE.active}`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </div>
                    {p.description && <p className="text-xs2 text-gray-400 line-clamp-2 mb-2">{p.description}</p>}
                    <p className="text-2xs text-gray-400">{nameFor(p.contact_id) ?? 'Personal'}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived projects — recoverable, tucked at the bottom */}
      {!loading && archived.length > 0 && (
        <div className="mt-10 border-t border-gray-100 pt-5">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Archive size={14} />
            Archived
            <span className="text-xs2 text-gray-300">{archived.length}</span>
          </button>

          {showArchived && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {archived.map((p) => (
                <div key={p.id} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-sm font-medium text-gray-600 truncate">{p.title}</h4>
                  </div>
                  <p className="text-2xs text-gray-400 mb-3">{nameFor(p.contact_id) ?? 'Personal'}</p>
                  <div className="mt-auto flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className="text-2xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      Open
                    </button>
                    {canManage && (
                      <button
                        onClick={() => void restoreProject(p.id)}
                        className="ml-auto inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-1.5 rounded-full text-white hover:opacity-90"
                        style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                      >
                        <ArchiveRestore size={12} /> Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showNew && (
        <NewProjectModal
          contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
          onCreate={async (payload) => { const p = await createProject(payload); router.push(`/projects/${p.id}`) }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  )
}

interface NewProjectModalProps {
  contacts: Array<{ id: string; name: string }>
  onCreate: (payload: { title: string; description: string | null; contact_id: string | null }) => Promise<void>
  onClose: () => void
}

function NewProjectModal({ contacts, onCreate, onClose }: NewProjectModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (title.trim().length < 2) { setError('Give the project a name.'); return }
    setSubmitting(true)
    setError('')
    try {
      await onCreate({ title: title.trim(), description: description.trim() || null, contact_id: contactId })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the project.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5 max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New project</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError('') }}
          placeholder="Project name…"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 mb-3"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Description (optional)"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 resize-none mb-3"
        />
        <div className="mb-4">
          <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Client</p>
          <select
            value={contactId ?? ''}
            onChange={(e) => setContactId(e.target.value || null)}
            className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
          >
            <option value="">None (personal)</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2 text-white rounded-full text-sm font-semibold disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
