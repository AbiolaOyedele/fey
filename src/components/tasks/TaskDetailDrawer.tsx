'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Trash2, Plus, Check, Lock } from 'lucide-react'
import type { Task, TaskPriority, Subtask, UpdateTaskPayload, WorkflowStage, RuleOnTaskPayload } from '@/types/work-tasks'
import { isStale, daysInStage, needsSignOff, canRule } from '@/types/work-tasks'
import type { MentionEntityType } from '@/types/mention'
import AssigneePicker from './AssigneePicker'
import PersonPicker from './PersonPicker'
import TaskApprovalBar from './TaskApprovalBar'
import TaskHandoffTrail from './TaskHandoffTrail'
import HandoffPrompt from './HandoffPrompt'
import DateField from '@/components/ui/DateField'
import TaskAttachments from './TaskAttachments'
import TaskComments from './TaskComments'
import TaskReviewPanel from './TaskReviewPanel'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useScrollLock } from '@/hooks/useScrollLock'
import { PRIORITY_META, formatMinutes, parseEstimate } from './TaskBits'
import { renderMentions, extractMentionedUserIds } from '@/utils/mentions'
import MentionAwareEditor, { type MentionAwareEditorHandle } from '@/components/mentions/MentionAwareEditor'
import ImageLightbox from '@/components/ui/ImageLightbox'
import { uploadToCloudinary } from '@/utils/cloudinary'
import { taskDescriptionUploadFolder } from '@/lib/constants'
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
  /**
   * Supply assignable people instead of loading the workspace team — the client
   * portal has its own, narrower list and can't authenticate as an app user.
   */
  members?: { user_id: string; name: string | null; email: string | null }[]
  /** Comments need workspace mentions, which a portal client has no access to. */
  /**
   * Hides the app's own comment thread — which reads the Supabase session and
   * the workspace roster, neither of which a portal user has. Pass
   * `commentsSlot` to put a different thread in its place rather than none.
   */
  hideComments?: boolean
  /** Rendered where the comment thread would be. Used by the client portal. */
  commentsSlot?: React.ReactNode
  /** Hides delete — clients don't remove tasks, they just stop tracking them. */
  hideDelete?: boolean
  /**
   * Set when rendered inside a client portal — the Review tab points its
   * requests at the portal endpoints instead of the app's.
   */
  portalSubdomain?: string | undefined
  /** Viewers read the review history but can't upload or rule on it. */
  reviewReadOnly?: boolean
  /**
   * The responsibility controls — the baton picker, the approval panel and the
   * handoff trail. All optional together: the client portal has no auth user to
   * hand work to, so it simply doesn't pass them and the section stays hidden.
   */
  currentUserId?: string | null
  /** Whether the viewer can manage the workspace (the fallback approver). */
  canManage?: boolean
  onSetResponsible?: (id: string, userId: string | null) => Promise<unknown>
  onRule?: (id: string, payload: RuleOnTaskPayload) => Promise<unknown>
}

type DrawerTab = 'details' | 'review'

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']
/** Sentinel for the synthetic "Completed" stage option — not a real stage_id. */
const COMPLETED_STAGE = '__completed__'

export default function TaskDetailDrawer(props: TaskDetailDrawerProps) {
  const { task, workspaceId, stages, onPatch, onSetAssignees, onAddSubtask, onToggleSubtask, onRenameSubtask, onDeleteSubtask, onAddFile, onRemoveFile, onDelete, onClose, members, hideComments, commentsSlot, hideDelete, portalSubdomain, reviewReadOnly, currentUserId, canManage, onSetResponsible, onRule } = props
  const confirm = useConfirm()
  useScrollLock()
  const [tab, setTab] = useState<DrawerTab>('details')

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const [estimate, setEstimate] = useState(task.estimated_minutes != null ? formatMinutes(task.estimated_minutes) : '')
  const [newSubtask, setNewSubtask] = useState('')
  // No 'saved' state: a successful save closes the drawer, so there's nothing
  // left on screen to confirm it on.
  const [saveState, setSaveState] = useState<'idle' | 'saving'>('idle')
  // A stage change held open while we ask who's picking the work up.
  const [pendingStage, setPendingStage] = useState<WorkflowStage | null>(null)
  const descriptionRef = useRef<MentionAwareEditorHandle>(null)
  const taskLink = task.contact_id ? `/clients/${task.contact_id}/tasks?taskId=${task.id}` : `/tasks?taskId=${task.id}`

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setIsEditingDescription(false)
    setDescriptionError(null)
    setEstimate(task.estimated_minutes != null ? formatMinutes(task.estimated_minutes) : '')
  }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An open image preview owns Escape first — closing both at once would
      // yank the drawer out from under the user.
      if (e.key === 'Escape' && !document.querySelector('[data-lightbox]')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const saveTitle = useCallback(() => {
    const t = title.trim()
    if (t && t !== task.title) void onPatch(task.id, { title: t })
    else setTitle(task.title)
  }, [title, task.id, task.title, onPatch])

  /** Hosts an image pasted into the description; only the URL is stored. */
  const uploadDescriptionImage = useCallback(async (file: File) => {
    setDescriptionError(null)
    const { promise } = uploadToCloudinary(file, taskDescriptionUploadFolder(task.id))
    const { url } = await promise
    return { url, name: file.name || 'image' }
  }, [task.id])

  const commitDescription = useCallback((value: string) => {
    setDescription(value)
    setIsEditingDescription(false)
    if (value !== (task.description ?? '')) {
      void onPatch(task.id, { description: value || null })
      void postMentions({
        workspaceId, entityType: 'task_description', entityId: task.id,
        link: taskLink, contextLabel: task.title, text: value,
      })
    }
  }, [task.id, task.description, task.title, workspaceId, taskLink, onPatch])

  /**
   * Explicit save. Fields already persist on blur, so this mostly flushes
   * whatever is still being edited — but it gives an unambiguous "it's saved"
   * moment, and on touch devices it's easier than blurring a field.
   */
  const handleSave = useCallback(async () => {
    setSaveState('saving')
    // Blurring the description commits it through the same path as autosave,
    // which also waits for any in-flight image upload.
    if (isEditingDescription) descriptionRef.current?.blur()

    const updates: UpdateTaskPayload = {}
    const t = title.trim()
    if (t && t !== task.title) updates.title = t
    else if (!t) setTitle(task.title)
    const minutes = parseEstimate(estimate)
    if (minutes !== (task.estimated_minutes ?? null)) updates.estimated_minutes = minutes

    try {
      if (Object.keys(updates).length > 0) await onPatch(task.id, updates)
      // Save means "I'm done here" — it closes. Leaving the drawer open after
      // an explicit save made the button look like it hadn't worked, since
      // every field had already written itself on blur and nothing visibly
      // changed. Only on success: a failed save has to stay put so the edit
      // isn't lost behind a closed drawer.
      onClose()
    } catch {
      setSaveState('idle')
    }
  }, [isEditingDescription, title, estimate, task.id, task.title, task.estimated_minutes, onPatch, onClose])

  const addSub = useCallback(async () => {
    const t = newSubtask.trim()
    if (!t) return
    setNewSubtask('')
    await onAddSubtask(task.id, t)
  }, [newSubtask, task.id, onAddSubtask])

  const doneSubs = task.subtasks.filter((s) => s.done).length

  // Responsibility only exists where there's a workspace to hand work to, so
  // the whole block is driven off the callers that supply the handlers.
  const stage = stages.find((s) => s.id === task.stage_id) ?? null
  const showResponsibility = Boolean(onSetResponsible)
  const gatedAndPending = needsSignOff(task, stage)
  const stalled = isStale(task, stage)
  // Mirrors the server's rule so the UI locks what the API would refuse — a
  // disabled control with a reason beats a save that bounces back unexplained.
  const stageLocked = gatedAndPending && !canRule(stage, currentUserId ?? null, canManage ?? false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/30 animate-fadeIn" />
      <div
        className="relative w-full max-w-xl max-h-[85dvh] bg-white rounded-2xl shadow-2xl overflow-y-auto overscroll-contain animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header + tabs stick together as one block, so the tab bar doesn't
            need to know how tall the header is. */}
        <div className="sticky top-0 z-10 bg-white rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {/* Which brand this is for is the first thing you need when a task is
              one of forty across six clients, so it reads as a heading rather
              than as small print. The fallbacks stay quiet — "Team" isn't a
              brand and shouldn't be dressed as one. */}
          <div className="flex items-center gap-2 min-w-0">
            {task.project_title ? (
              <span className="truncate text-sm font-semibold text-gray-800">{task.project_title}</span>
            ) : task.contact_name ? (
              <span className="truncate text-sm font-semibold text-gray-800">{task.contact_name}</span>
            ) : (
              <span className="text-xs2 text-gray-400">{task.visibility === 'team' ? 'Team' : 'Personal'}</span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1 px-5 border-b border-gray-100">
          {([['details', 'Details'], ['review', 'Review']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`px-3 min-h-11 text-xs2 font-medium border-b-2 -mb-px transition-colors ${
                tab === key ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
              style={tab === key ? { color: 'var(--accent, #ED64A6)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>
        </div>

        {tab === 'review' ? (
          <div className="p-5">
            <TaskReviewPanel
              taskId={task.id}
              subdomain={portalSubdomain}
              readOnly={reviewReadOnly ?? false}
            />
          </div>
        ) : (
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

          {/* Sign-off. Sits above everything else because when a task is gated,
              nothing else on this screen can move until it's answered. */}
          {onRule && (
            <TaskApprovalBar
              task={task}
              stage={stage}
              currentUserId={currentUserId ?? null}
              canManage={canManage ?? false}
              onRule={(payload) => onRule(task.id, payload).then(() => undefined)}
            />
          )}

          {/* Stalled here — the fair version of "late": measured from when the
              task arrived in this stage, not against a deadline the whole chain
              shares. */}
          {stalled && !gatedAndPending && stage?.target_days && (
            <p className="text-xs2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 break-words">
              Sat in {stage.name} for {daysInStage(task)} days — the target here is {stage.target_days}.
            </p>
          )}

          {/* Meta grid */}
          <div className="space-y-3 text-sm">
            {/* Visibility — only for unlinked (no client/project) tasks */}
            {!task.contact_id && !task.project_id && (
              <Field label="Visibility">
                <div className="flex gap-1.5">
                  {/* Team first, as in the compose sheet — the two shouldn't
                      disagree about which one is the ordinary choice. */}
                  {(['team', 'personal'] as const).map((v) => (
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

            {/* Stage — "Completed" is a synthetic option, not a real workflow
             *  stage, so picking it marks the task done and sends it straight
             *  to the Completed tab instead of writing a stage_id. */}
            {stages.length > 0 && (
              <Field label="Stage">
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={task.done ? COMPLETED_STAGE : (task.stage_id ?? '')}
                    disabled={stageLocked}
                    onChange={(e) => {
                      const next = e.target.value
                      if (next === COMPLETED_STAGE) { if (!task.done) props.onToggleDone(task.id); return }
                      // A stage that asks who's next has to ask here too. The
                      // board prompted and this didn't, so changing the stage
                      // from inside a task moved the work and quietly left the
                      // baton behind — the rule was set and not applied.
                      const target = stages.find((s) => s.id === next) ?? null
                      if (target && target.handoff_mode === 'prompt' && target.id !== task.stage_id) {
                        setPendingStage(target)
                        return
                      }
                      // Moving a completed task back to a real stage has to clear
                      // `done` too. Without it the row keeps its completed flag,
                      // the select re-reads as "Completed", and the change looks
                      // like it silently failed.
                      void onPatch(task.id, {
                        stage_id: next || null,
                        ...(task.done ? { done: false } : {}),
                      })
                    }}
                    className="px-2.5 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.requires_approval ? ' (needs sign-off)' : ''}
                      </option>
                    ))}
                    <option value={COMPLETED_STAGE}>Completed</option>
                  </select>
                  {stageLocked && (
                    <span className="inline-flex items-center gap-1 text-2xs text-gray-400">
                      <Lock size={11} /> Awaiting sign-off
                    </span>
                  )}
                </div>
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

            {/* Whose desk it's on. Distinct from assignees on purpose:
                assignees are who's involved, this is who's answerable today —
                and the only person it counts as overdue for. */}
            {showResponsibility && onSetResponsible && (
              <Field label="On the desk of">
                <PersonPicker
                  {...(members ? { members } : {})}
                  workspaceId={workspaceId}
                  selectedId={task.responsible_id}
                  onChange={(id) => void onSetResponsible(task.id, id)}
                  title="Who's holding this task?"
                  emptyLabel="Nobody yet"
                  clearable
                  clearLabel="Nobody"
                  disabled={stageLocked}
                />
              </Field>
            )}

            {/* Assignees */}
            <Field label="Assignees">
              <AssigneePicker
                {...(members ? { members } : {})}
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
                ref={descriptionRef}
                initialValue={description}
                workspaceId={workspaceId}
                multiline
                autoFocus
                placeholder="Add more detail, or paste an image…"
                className="w-full min-h-[6rem] text-sm px-3 py-2.5 rounded-xl border border-gray-200 focus:border-gray-400"
                uploadImage={uploadDescriptionImage}
                onImageError={setDescriptionError}
                onCommit={commitDescription}
                onEscape={() => setIsEditingDescription(false)}
              />
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsEditingDescription(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEditingDescription(true) }
                }}
                className="w-full text-left text-sm px-3 py-2.5 rounded-xl -mx-3 hover:bg-gray-50 transition-colors cursor-text"
              >
                {description ? (
                  <div className="whitespace-pre-wrap break-words text-gray-700">
                    {renderMentions(description, { onImageClick: setPreview })}
                  </div>
                ) : (
                  <p className="text-gray-400">Add more detail, or paste an image…</p>
                )}
              </div>
            )}
            {descriptionError && <p className="mt-1.5 text-xs2 text-red-500">{descriptionError}</p>}
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

          {/* Where it's been. Keyed on stage + holder + state so a move made
              from this drawer refreshes the trail instead of leaving it stale. */}
          {showResponsibility && (
            <div>
              <p className="text-xs2 font-semibold text-gray-400 uppercase tracking-wider mb-1.5">History</p>
              <TaskHandoffTrail
                taskId={task.id}
                reloadKey={`${task.stage_id ?? ''}:${task.responsible_id ?? ''}:${task.approval_state}`}
              />
            </div>
          )}

          {/* Comments — the app's own thread, or whatever the caller puts here. */}
          {commentsSlot ?? (!hideComments && (
            <TaskComments taskId={task.id} workspaceId={workspaceId} taskLink={taskLink} taskTitle={task.title} />
          ))}

          {/* Delete */}
          {!hideDelete && (
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
          )}
        </div>
        )}

        {/* Save — everything here autosaves, so this flushes whatever field is
         *  still being edited and then gets out of the way. Review has nothing
         *  pending to flush, so the bar is details-only. */}
        {tab === 'details' && (
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white/95 backdrop-blur border-t border-gray-100 rounded-b-2xl">
          <span className="text-xs2 text-gray-400 min-w-0 truncate" aria-live="polite">
            Changes save automatically
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveState === 'saving'}
            className="min-h-[44px] px-5 rounded-xl text-sm font-medium text-white flex-shrink-0 disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save & close'}
          </button>
        </div>
        )}
      </div>

      {pendingStage && (
        <HandoffPrompt
          taskTitle={task.title}
          stageName={pendingStage.name}
          currentHolderId={task.responsible_id}
          workspaceId={workspaceId}
          {...(members ? { members } : {})}
          onChoose={(userId) => {
            void onPatch(task.id, {
              stage_id: pendingStage.id,
              responsible_id: userId,
              ...(task.done ? { done: false } : {}),
            })
            setPendingStage(null)
          }}
          // Cancelling leaves the task where it was; the select re-reads from
          // the task, so it snaps back on its own.
          onCancel={() => setPendingStage(null)}
        />
      )}

      {preview && (
        <ImageLightbox url={preview.url} name={preview.name} onClose={() => setPreview(null)} />
      )}
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
      <button onClick={onDelete} className="reveal-on-hover tap-target text-gray-300 hover:text-red-400">
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
