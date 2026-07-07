'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Trash2, Plus, Check } from 'lucide-react'
import type { Task, TaskPriority, Subtask, UpdateTaskPayload, WorkflowStage } from '@/types/work-tasks'
import type { MentionEntityType } from '@/types/mention'
import AssigneePicker from './AssigneePicker'
import DateField from '@/components/ui/DateField'
import TaskAttachments from './TaskAttachments'
import TaskComments from './TaskComments'
import { useConfirm } from '@/contexts/ConfirmContext'
import { PRIORITY_META, formatMinutes, parseEstimate } from './TaskBits'
import { renderMentions, extractMentionedUserIds } from '@/utils/mentions'
import MentionAwareEditor from '@/components/mentions/MentionAwareEditor'
import { apiFetch } from '@/lib/api-client'

/** Fire-and-forget: records any @mentions in `text` and notifies the newly-mentioned. */
async function postMentions(args: {
  workspaceId: string | null | undefined
  entityType: MentionEntityType
  entityId: string
  link: string
  contextLabel: string
  text: string
}) {
  const userIds = extractMentionedUserIds(args.text)
  if (userIds.length === 0) return
  try {
    await apiFetch('/api/v1/mentions', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: args.workspaceId ?? null,
        entityType: args.entityType,
        entityId: args.entityId,
        link: args.link,
        contextLabel: args.contextLabel,
        userIds,
      }),
    })
  } catch { /* best-effort */ }
}

interface TaskDetailDrawerProps {
  task: Task
  workspaceId: string | null | undefined
  stages: WorkflowStage[]
  onPatch: (id: string, updates: UpdateTaskPayload) => Promise<Task | void>
  onSetAssignees: (id: string, ids: string[]) => Promise<void>
  onAddSubtask: (taskId: string, title: string) => Promise<void>
  onToggleSubtask: (taskId: string, subtaskId: string, done: boolean) => Promise<void>
  onRenameSubtask: (taskId: string, subtaskId: string, title: string) => Promise<void>
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<void>
  onAddFile: (taskId: string, payload: { file_name: string; file_url: string; public_id: string; file_size?: number | null; file_type?: string | null }) => Promise<unknown>
  onRemoveFile: (taskId: string, fileId: string) => Promise<void>
  onToggleDone: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']

export default function TaskDetailDrawer(props: TaskDetailDrawerProps) {
  const { task, workspaceId, stages, onPatch, onSetAssignees, onAddSubtask, onToggleSubtask, onRenameSubtask, onDeleteSubtask, onAddFile, onRemoveFile, onDelete, onClose } = props
  const confirm = useConfirm()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [estimate, setEstimate] = useState(task.estimated_minutes != null ? formatMinutes(task.estimated_minutes) : '')
  const [newSubtask, setNewSubtask] = useState('')
  const taskLink = task.contact_id ? `/clients/${task.contact_id}/tasks?taskId=${task.id}` : `/tasks?taskId=${task.id}`

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setIsEditingDescription(false)
    setEstimate(task.estimated_minutes != null ? formatMinutes(task.estimated_minutes) : '')
  }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const saveTitle = useCallback(() => {
    const t = title.trim()
    if (t && t !== task.title) void onPatch(task.id, { title: t })
    else setTitle(task.title)
  }, [title, task.id, task.title, onPatch])

  const addSub = useCallback(async () => {
    const t = newSubtask.trim()
    if (!t) return
    setNewSubtask('')
    await onAddSubtask(task.id, t)
  }, [newSubtask, task.id, onAddSubtask])

  const doneSubs = task.subtasks.filter((s) => s.done).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/30 animate-fadeIn" />
      <div
        className="relative w-full max-w-xl max-h-[85dvh] bg-white rounded-2xl shadow-2xl overflow-y-auto animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-2 text-xs2 text-gray-400 min-w-0">
            {task.project_title ? <span className="truncate">{task.project_title}</span>
              : task.contact_name ? <span className="truncate">{task.contact_name}</span>
              : <span>{task.visibility === 'team' ? 'Team' : 'Personal'}</span>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Title + done */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => props.onToggleDone(task.id)}
              className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${task.done ? 'border-transparent text-white' : 'border-gray-300'}`}
              style={task.done ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
            >
              {task.done && <Check size={12} strokeWidth={3} />}
            </button>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              rows={1}
              className="flex-1 text-lg font-semibold text-gray-900 resize-none outline-none leading-snug"
            />
          </div>

          {/* Meta grid */}
          <div className="space-y-3 text-sm">
            {/* Visibility — only for unlinked (no client/project) tasks */}
            {!task.contact_id && !task.project_id && (
              <Field label="Visibility">
                <div className="flex gap-1.5">
                  {(['personal', 'team'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => void onPatch(task.id, { visibility: v })}
                      className={`px-2.5 py-1 rounded-lg text-xs2 font-medium border capitalize transition-colors ${
                        task.visibility === v ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {/* Stage */}
            {stages.length > 0 && (
              <Field label="Stage">
                <select
                  value={task.stage_id ?? ''}
                  onChange={(e) => void onPatch(task.id, { stage_id: e.target.value || null })}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
                >
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}

            {/* Priority */}
            <Field label="Priority">
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => void onPatch(task.id, { priority: p })}
                    className={`px-2.5 py-1 rounded-lg text-xs2 font-medium border transition-colors ${
                      task.priority === p ? `${PRIORITY_META[p].bg} ${PRIORITY_META[p].text} border-transparent` : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Assignees */}
            <Field label="Assignees">
              <AssigneePicker
                workspaceId={workspaceId}
                selectedIds={task.assignees.map((a) => a.user_id)}
                onChange={(ids) => void onSetAssignees(task.id, ids)}
              />
            </Field>

            {/* Dates */}
            <Field label="Start">
              <DateInput value={task.start_date} onChange={(v) => void onPatch(task.id, { start_date: v })} />
            </Field>
            <Field label="Due">
              <DateInput value={task.due_date} onChange={(v) => void onPatch(task.id, { due_date: v })} />
            </Field>

            {/* Estimate */}
            <Field label="Estimate">
              <input
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                onBlur={() => void onPatch(task.id, { estimated_minutes: parseEstimate(estimate) })}
                placeholder="e.g. 2h 30m"
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm w-28 outline-none focus:border-gray-400"
              />
            </Field>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs2 font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Description</p>
            {isEditingDescription ? (
              <MentionAwareEditor
                initialValue={description}
                workspaceId={workspaceId}
                multiline
                autoFocus
                placeholder="Add more detail…"
                className="w-full min-h-[6rem] text-sm px-3 py-2.5 rounded-xl border border-gray-200 focus:border-gray-400"
                onCommit={(value) => {
                  setDescription(value)
                  setIsEditingDescription(false)
                  if (value !== (task.description ?? '')) {
                    void onPatch(task.id, { description: value || null })
                    void postMentions({
                      workspaceId, entityType: 'task_description', entityId: task.id,
                      link: taskLink, contextLabel: task.title, text: value,
                    })
                  }
                }}
                onEscape={() => setIsEditingDescription(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingDescription(true)}
                className="w-full text-left text-sm px-3 py-2.5 rounded-xl -mx-3 hover:bg-gray-50 transition-colors"
              >
                {description ? (
                  <p className="whitespace-pre-wrap text-gray-700">{renderMentions(description)}</p>
                ) : (
                  <p className="text-gray-400">Add more detail…</p>
                )}
              </button>
            )}
          </div>

          {/* Attachments */}
          <div>
            <p className="text-xs2 font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Attachments {task.files.length > 0 && <span className="text-gray-300">· {task.files.length}</span>}
            </p>
            <TaskAttachments taskId={task.id} files={task.files} onAdd={onAddFile} onRemove={onRemoveFile} />
          </div>

          {/* Subtasks */}
          <div>
            <p className="text-xs2 font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Subtasks {task.subtasks.length > 0 && <span className="text-gray-300">· {doneSubs}/{task.subtasks.length}</span>}
            </p>
            <div className="space-y-1 mb-2">
              {task.subtasks.map((s) => (
                <SubtaskRow
                  key={s.id}
                  subtask={s}
                  workspaceId={workspaceId}
                  onToggle={() => void onToggleSubtask(task.id, s.id, !s.done)}
                  onRename={(t) => {
                    void onRenameSubtask(task.id, s.id, t)
                    void postMentions({
                      workspaceId, entityType: 'subtask', entityId: s.id,
                      link: taskLink, contextLabel: `${task.title} — ${t}`, text: t,
                    })
                  }}
                  onDelete={() => void onDeleteSubtask(task.id, s.id)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Plus size={14} className="text-gray-300" />
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void addSub() }}
                placeholder="Add a subtask…"
                className="flex-1 text-sm py-1 outline-none placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Comments */}
          <TaskComments taskId={task.id} workspaceId={workspaceId} taskLink={taskLink} taskTitle={task.title} />

          {/* Delete */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete this task?',
                  message: 'This permanently removes the task and its subtasks. This can’t be undone.',
                  confirmLabel: 'Delete',
                })
                if (ok) { void onDelete(task.id); onClose() }
              }}
              className="flex items-center gap-1.5 text-xs2 font-medium text-red-500 hover:text-red-600"
            >
              <Trash2 size={14} /> Delete task
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SubtaskRow({
  subtask, workspaceId, onToggle, onRename, onDelete,
}: {
  subtask: Subtask
  workspaceId: string | null | undefined
  onToggle: () => void
  onRename: (title: string) => void
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="group flex items-center gap-2.5 py-1">
      <button
        onClick={onToggle}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${subtask.done ? 'border-transparent text-white' : 'border-gray-300'}`}
        style={subtask.done ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
      >
        {subtask.done && <Check size={9} strokeWidth={3} />}
      </button>
      {isEditing ? (
        <div className="flex-1">
          <MentionAwareEditor
            initialValue={subtask.title}
            workspaceId={workspaceId}
            autoFocus
            className="w-full text-sm py-0.5 border-b border-gray-200 focus:border-gray-400"
            onCommit={(value) => {
              setIsEditing(false)
              const trimmed = value.trim()
              if (trimmed && trimmed !== subtask.title) onRename(trimmed)
            }}
            onEscape={() => setIsEditing(false)}
          />
        </div>
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={`flex-1 text-sm cursor-text ${subtask.done ? 'line-through text-gray-400' : 'text-gray-700'}`}
        >
          {renderMentions(subtask.title)}
        </span>
      )}
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs2 text-gray-400 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function DateInput({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return <DateField value={value} onChange={onChange} clearable />
}
