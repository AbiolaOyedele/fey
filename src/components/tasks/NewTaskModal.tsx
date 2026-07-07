'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useContacts } from '@/hooks/useCrm'
import { useProjects } from '@/hooks/useProjects'
import AssigneePicker from './AssigneePicker'
import DateField from '@/components/ui/DateField'
import { PRIORITY_META } from './TaskBits'
import type { CreateTaskPayload, TaskPriority, TaskVisibility } from '@/types/work-tasks'

interface NewTaskModalProps {
  workspaceId: string | null | undefined
  /** Pre-selected client/project — when set, the link pickers are hidden. */
  fixedContactId?: string | null
  fixedProjectId?: string | null
  onCreate: (payload: CreateTaskPayload) => Promise<unknown>
  onClose: () => void
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']

export default function NewTaskModal({ workspaceId, fixedContactId, fixedProjectId, onCreate, onClose }: NewTaskModalProps) {
  const linkLocked = fixedContactId != null || fixedProjectId != null
  const { contacts } = useContacts()
  const [contactId, setContactId] = useState<string | null>(fixedContactId ?? null)
  const { projects } = useProjects(contactId)
  const [projectId, setProjectId] = useState<string | null>(fixedProjectId ?? null)

  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<TaskVisibility>('personal')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) { setError('Add a task title.'); return }
    setSubmitting(true)
    setError('')
    try {
      await onCreate({
        title: title.trim(),
        priority,
        due_date: dueDate || null,
        contact_id: projectId ? null : contactId,
        project_id: projectId,
        visibility,
        assignee_ids: assigneeIds,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the task.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-5 max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New task</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) void submit() }}
          placeholder="Task title…"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 mb-4"
        />

        {!linkLocked && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div>
              <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Client</p>
              <select
                value={contactId ?? ''}
                onChange={(e) => { setContactId(e.target.value || null); setProjectId(null) }}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
              >
                <option value="">None (personal)</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Brand</p>
              <select
                value={projectId ?? ''}
                onChange={(e) => setProjectId(e.target.value || null)}
                disabled={!contactId}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-300"
              >
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* No client → choose who can see it */}
        {!linkLocked && !contactId && !projectId && (
          <div className="mb-4">
            <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Visibility</p>
            <div className="flex gap-1.5">
              {([
                { v: 'personal' as const, label: 'Personal', hint: 'Only you & assignees' },
                { v: 'team' as const, label: 'Team', hint: 'Everyone in the workspace' },
              ]).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setVisibility(o.v)}
                  title={o.hint}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs2 font-medium border transition-colors ${
                    visibility === o.v ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-2.5 py-1.5 rounded-lg text-xs2 font-medium border transition-colors ${
                  priority === p ? `${PRIORITY_META[p].bg} ${PRIORITY_META[p].text} border-transparent` : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
          <DateField value={dueDate || null} onChange={(v) => setDueDate(v ?? '')} placeholder="Due date" clearable />
          <AssigneePicker workspaceId={workspaceId} selectedIds={assigneeIds} onChange={setAssigneeIds} />
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
            Add task
          </button>
        </div>
      </div>
    </div>
  )
}
