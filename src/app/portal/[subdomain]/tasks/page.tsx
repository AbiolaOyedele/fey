'use client'

import { use, useState, useEffect, useCallback, useMemo } from 'react'
import { CheckSquare2, Check, Plus, Search, Download, FileText, X, Loader2 } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { usePortalSession } from '@/contexts/PortalSessionContext'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/motion'
import { getFileType, isImageType, formatFileSize, downloadUrl, thumbUrl, type FileType } from '@/utils/cloudinary'
import type { ClientTeamMember, PortalTask, PortalTaskFile } from '@/types/crm'

type Tab = 'open' | 'done'

const PRIORITY: Record<PortalTask['priority'], { label: string; dot: string }> = {
  high:   { label: 'High',   dot: '#EF4444' },
  medium: { label: 'Medium', dot: '#F59E0B' },
  low:    { label: 'Low',    dot: '#22C55E' },
}

function formatDue(due: string): string {
  const d = new Date(due + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** True for a due date already in the past — the one thing worth colouring red. */
function isOverdue(due: string): boolean {
  return new Date(due + 'T23:59:59') < new Date()
}

/** Read-only attachment strip: thumbs open full-size, everything gets a download. */
function TaskFiles({ files }: { files: PortalTaskFile[] }) {
  if (files.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {files.map((f) => {
        const type = (f.file_type as FileType) ?? getFileType(f.file_name)
        return (
          <span key={f.id} className="inline-flex items-center gap-1 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden">
            <a href={f.file_url} target="_blank" rel="noopener noreferrer" title={f.file_name} className="flex items-center gap-1">
              {isImageType(type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl(f.file_url, 64)} alt={f.file_name} className="w-8 h-8 object-cover" loading="lazy" />
              ) : (
                <span className="flex items-center gap-1 pl-1.5 py-1 max-w-[140px]">
                  <FileText size={12} className="text-gray-400 flex-shrink-0" />
                  <span className="text-2xs text-gray-500 truncate">{f.file_name}</span>
                  {f.file_size ? <span className="text-3xs text-gray-300 flex-shrink-0">{formatFileSize(f.file_size)}</span> : null}
                </span>
              )}
            </a>
            <a
              href={downloadUrl(f.file_url)}
              title={`Download ${f.file_name}`}
              className="px-1.5 py-1 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <Download size={12} />
            </a>
          </span>
        )
      })}
    </div>
  )
}

/** Initials avatar for an assigned team member. */
function MemberChip({ name, accent }: { name: string; accent: string }) {
  return (
    <span
      title={name}
      className="inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2 py-0.5 bg-gray-50 border border-gray-100"
    >
      <span
        aria-hidden
        className="w-4 h-4 rounded-full flex items-center justify-center text-3xs font-semibold text-white"
        style={{ backgroundColor: accent }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="text-2xs text-gray-500 truncate max-w-[90px]">{name}</span>
    </span>
  )
}

// ── New task ────────────────────────────────────────────────────────────────

interface NewTaskModalProps {
  accent: string
  members: ClientTeamMember[]
  onCreate: (payload: {
    title: string
    description: string | null
    due_date: string | null
    priority: PortalTask['priority']
    assignee_ids: string[]
  }) => Promise<void>
  onClose: () => void
}

function NewTaskModal({ accent, members, onCreate, onClose }: NewTaskModalProps) {
  const [title, setTitle]       = useState('')
  const [description, setDesc]  = useState('')
  const [due, setDue]           = useState('')
  const [priority, setPriority] = useState<PortalTask['priority']>('medium')
  const [assignees, setAssign]  = useState<string[]>([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const toggleAssignee = (id: string) =>
    setAssign((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const submit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        due_date: due || null,
        priority,
        assignee_ids: assignees,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That task couldn’t be created. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-gray-100 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 sticky top-0 bg-white">
          <h2 className="font-display text-base font-normal text-gray-800">New task</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-3 flex items-center justify-center text-gray-300 hover:text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#FDECEC', color: '#E53E3E' }}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="task-title" className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">
              What needs doing
            </label>
            <input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Add a title…"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label htmlFor="task-desc" className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">
              Details <span className="normal-case tracking-normal font-normal text-gray-300">(optional)</span>
            </label>
            <textarea
              id="task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Anything the team should know."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-due" className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">
                Due
              </label>
              <input
                id="task-due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">Priority</span>
              <div className="flex bg-gray-100 rounded-xl p-0.5">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2 rounded-lg text-2xs font-medium transition-colors ${
                      priority === p ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'
                    }`}
                  >
                    {PRIORITY[p].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">
              Assign to
            </span>
            {members.length === 0 ? (
              <p className="text-2xs text-gray-400 leading-relaxed rounded-xl bg-gray-50 border border-gray-100 p-3">
                Nobody from the team is available to assign yet. Your task will still reach them.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const on = assignees.includes(m.user_id)
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => toggleAssignee(m.user_id)}
                      aria-pressed={on}
                      className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1.5 border text-xs transition-colors min-h-[36px]"
                      style={
                        on
                          ? { borderColor: accent, backgroundColor: `${accent}12`, color: '#374151' }
                          : { borderColor: '#F1F1F1', color: '#6B7280' }
                      }
                    >
                      <span
                        aria-hidden
                        className="w-6 h-6 rounded-full flex items-center justify-center text-2xs font-semibold text-white"
                        style={{ backgroundColor: on ? accent : '#CBD5E1' }}
                      >
                        {on ? <Check size={11} /> : m.name.charAt(0).toUpperCase()}
                      </span>
                      {m.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-50 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-full text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!title.trim() || saving}
            className="press inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-full text-white text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: accent }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PortalTasksPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const accent  = usePortalAccent(subdomain)
  const session = usePortalSession()
  // Viewers are read-only by definition, so they never see the compose affordance.
  const canCreate = session ? session.session.portalUser.role !== 'viewer' : false

  const [tasks,   setTasks]   = useState<PortalTask[]>([])
  const [members, setMembers] = useState<ClientTeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [tab,     setTab]     = useState<Tab>('open')
  const [search,  setSearch]  = useState('')
  const [showNew, setShowNew] = useState(false)

  const headers = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [subdomain])

  const load = useCallback(async () => {
    const h = headers()
    if (!h) { setLoading(false); return }
    setLoading(true)
    setError(false)
    try {
      // The team list is only needed to assign, but it's small and fetching it
      // alongside avoids a spinner inside the modal.
      const [tasksRes, teamRes] = await Promise.all([
        fetch('/api/v1/portal/tasks', { headers: h }),
        fetch('/api/v1/portal/team',  { headers: h }),
      ])
      if (!tasksRes.ok) { setError(true); return }
      const d = await tasksRes.json() as { tasks: PortalTask[] }
      setTasks(d.tasks)
      if (teamRes.ok) {
        const t = await teamRes.json() as { members: ClientTeamMember[] }
        setMembers(t.members)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    // Loading a list IS synchronising with an external system; the rule fires
    // only because the fetch starts synchronously rather than from a callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const create = async (payload: {
    title: string
    description: string | null
    due_date: string | null
    priority: PortalTask['priority']
    assignee_ids: string[]
  }) => {
    const h = headers()
    if (!h) throw new Error('You’ve been signed out. Please sign in again.')
    const res = await fetch('/api/v1/portal/tasks', { method: 'POST', headers: h, body: JSON.stringify(payload) })
    if (!res.ok) {
      const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
      throw new Error(d?.error?.message ?? 'That task couldn’t be created.')
    }
    const d = await res.json() as { task: PortalTask }
    setTasks((prev) => [...prev, d.task])
  }

  const toggleDone = async (task: PortalTask) => {
    const h = headers()
    if (!h) return
    const next = !task.done
    // Optimistic — the tick lands now and rolls back if the save fails.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: next } : t)))
    try {
      const res = await fetch(`/api/v1/portal/tasks/${task.id}`, {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ done: next }),
      })
      if (!res.ok) throw new Error('save failed')
      const d = await res.json() as { task: PortalTask }
      setTasks((prev) => prev.map((t) => (t.id === d.task.id ? d.task : t)))
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)))
    }
  }

  const openCount = tasks.filter((t) => !t.done).length
  const doneCount = tasks.length - openCount

  const visible = useMemo(() => {
    let list = tasks.filter((t) => (tab === 'done' ? t.done : !t.done))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.title.toLowerCase().includes(q))
    }
    return list
  }, [tasks, tab, search])

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <CheckSquare2 size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Tasks</h1>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          What&apos;s in progress, and anything you&apos;d like the team to pick up.
        </p>
      </FadeIn>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {([['open', `Open${openCount ? ` · ${openCount}` : ''}`], ['done', `Done${doneCount ? ` · ${doneCount}` : ''}`]] as const).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-2 min-h-[36px] rounded-md text-xs font-medium transition-colors ${
                  tab === key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>

        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="w-full pl-8 pr-3 py-2 min-h-[40px] rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
          />
        </div>

        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="press flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-white rounded-full text-sm font-semibold hover:opacity-90 ml-auto"
            style={{ backgroundColor: accent }}
          >
            <Plus size={15} /> New task
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare2 size={28} className="text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500">Couldn&apos;t load your tasks</p>
          <button onClick={() => void load()} className="text-xs mt-2 font-semibold" style={{ color: accent }}>
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare2 size={28} className="text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {search.trim() ? 'Nothing matches that search' : tab === 'done' ? 'Nothing completed yet' : 'No open tasks'}
          </p>
          {!search.trim() && tab === 'open' && (
            <p className="text-xs text-gray-400 mt-1">
              {canCreate ? 'Add one and the team will see it straight away.' : 'Tasks for your work will appear here.'}
            </p>
          )}
        </div>
      ) : (
        <Stagger className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {visible.map((t) => (
            <StaggerItem key={t.id}>
              <div className="flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 last:border-b-0">
                {/* Only tasks the client raised are theirs to close — the API
                    enforces the same rule, so an agency task shows a static
                    marker rather than a control that would always fail. */}
                {t.requested_by_client && canCreate ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={t.done}
                    aria-label={t.done ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`}
                    onClick={() => void toggleDone(t)}
                    className="-m-3 p-3 flex-shrink-0 flex items-start"
                  >
                    <span
                      aria-hidden
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                        t.done ? '' : 'border-2 border-gray-200 hover:border-gray-300'
                      }`}
                      style={t.done ? { backgroundColor: accent } : {}}
                    >
                      {t.done && <Check size={12} className="text-white" />}
                    </span>
                  </button>
                ) : (
                  <span
                    aria-hidden
                    className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                      t.done ? '' : 'border-2 border-gray-200'
                    }`}
                    style={t.done ? { backgroundColor: accent } : {}}
                  >
                    {t.done && <Check size={12} className="text-white" />}
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <span className={`text-sm flex-1 min-w-0 ${t.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {t.title}
                    </span>
                    <span
                      aria-hidden
                      title={`${PRIORITY[t.priority].label} priority`}
                      className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PRIORITY[t.priority].dot }}
                    />
                  </div>

                  {t.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{t.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-1.5">
                    {t.project_title && (
                      <span className="text-2xs text-gray-400 truncate max-w-[160px]">{t.project_title}</span>
                    )}
                    {t.due_date && (
                      <span
                        className="text-2xs"
                        style={{ color: !t.done && isOverdue(t.due_date) ? '#E53E3E' : '#9CA3AF' }}
                      >
                        {!t.done && isOverdue(t.due_date) ? 'Overdue · ' : 'Due '}
                        {formatDue(t.due_date)}
                      </span>
                    )}
                    {t.requested_by_client && (
                      <span className="text-2xs text-gray-300">Raised by you</span>
                    )}
                    {t.assignees.map((a) => (
                      <MemberChip key={a.user_id} name={a.name} accent={accent} />
                    ))}
                  </div>

                  <TaskFiles files={t.files} />
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {showNew && (
        <NewTaskModal
          accent={accent}
          members={members}
          onCreate={create}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  )
}
