'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useTasks } from '@/hooks/useTasks'
import { useWorkflows } from '@/hooks/useWorkflows'
import TaskListView from '@/components/tasks/TaskListView'
import TaskBoardView from '@/components/tasks/TaskBoardView'
import TaskTableView from '@/components/tasks/TaskTableView'
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer'
import NewTaskModal from '@/components/tasks/NewTaskModal'
import WorkflowEditorModal from '@/components/tasks/WorkflowEditorModal'
import InsightsPanel from '@/components/tasks/analytics/InsightsPanel'
import { TaskBoardSkeleton, TaskRowsSkeleton, TaskTableSkeleton } from '@/components/ui/skeletons'
import { SlidersHorizontal } from 'lucide-react'
import type { Task } from '@/types/work-tasks'

type View = 'board' | 'table' | 'list' | 'completed' | 'insights'

/**
 * How the list is narrowed.
 *
 * `desk` and `involved` are the two halves of what used to be one "Personal"
 * tab. Splitting them is the point of the whole handoff model: work you're
 * answerable for today has to be separable from work you're merely attached to,
 * or handing a task on would either keep nagging you or make it vanish.
 */
type SubTab = 'desk' | 'involved' | 'all'

const SUB_TABS: Array<{ key: SubTab; label: string }> = [
  { key: 'desk',     label: 'My desk' },
  { key: 'involved', label: 'Involved' },
  { key: 'all',      label: 'All' },
]

const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'board', label: 'Board' },
  { key: 'table', label: 'Table' },
  { key: 'list', label: 'List' },
  { key: 'completed', label: 'Completed' },
  { key: 'insights', label: 'Insights' },
]

/** Views that read the task list. Insights has its own aggregated source. */
function isListView(view: View): boolean {
  return view !== 'insights'
}

export default function TasksPage() {
  const { user } = useAuth()
  const { settings, showToast } = useSettings()
  const { workspace, canManage } = useWorkspace()
  const wsId = workspace?.id ?? null
  const searchParams = useSearchParams()
  const deepLinkTaskId = searchParams.get('taskId')
  // The dashboard links straight to the insights tab.
  const deepLinkView = searchParams.get('view')

  const [view, setView] = useState<View>(deepLinkView === 'insights' ? 'insights' : 'list')
  // Opens on the user's own desk: the first question on arriving is "what's
  // mine right now", and that's exactly the list the baton makes possible.
  const [subTab, setSubTab] = useState<SubTab>('desk')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Task | null>(null)
  const [showNew, setShowNew] = useState(false)

  // Fetch the full workspace-wide set (server-scoped by role: admins get every
  // task, members get theirs + team-visible). The Personal sub-tab narrows this
  // to the current user's own tasks client-side.
  const active = useTasks({ scope: 'all', workspaceId: wsId, done: false, onError: showToast })
  const completed = useTasks({ scope: 'all', workspaceId: wsId, done: true, onError: showToast })
  const { workflows, addStage, updateStage, deleteStage, reorderStages } = useWorkflows(wsId)

  const [showWorkflow, setShowWorkflow] = useState(false)
  const defaultWorkflow = useMemo(() => workflows.find((w) => w.is_default) ?? workflows[0] ?? null, [workflows])
  const defaultStages = defaultWorkflow?.stages ?? []

  // Deep-link support: ?taskId=<id> (e.g. from a mention notification) auto-opens the
  // drawer once — a ref (not state) tracks it so closing the drawer doesn't reopen it
  // on the next background refetch.
  const consumedDeepLink = useRef<string | null>(null)
  useEffect(() => {
    if (!deepLinkTaskId || deepLinkTaskId === consumedDeepLink.current) return
    if (active.loading || completed.loading) return
    const found = active.tasks.find((t) => t.id === deepLinkTaskId) ?? completed.tasks.find((t) => t.id === deepLinkTaskId)
    if (found) { setSelected(found); consumedDeepLink.current = deepLinkTaskId }
  }, [deepLinkTaskId, active.loading, active.tasks, completed.loading, completed.tasks])

  const source = view === 'completed' ? completed : active
  const filtered = useMemo(() => {
    let list = source.tasks
    if (user) {
      // My desk: work sitting with me right now — the list I'm answerable for.
      if (subTab === 'desk') {
        list = list.filter((t) => t.responsible_id === user.id)
      }
      // Involved: work I'm attached to that somebody else is holding. Handing a
      // task on takes it off my desk without hiding it — I still need to see
      // what I'm waiting on.
      if (subTab === 'involved') {
        list = list.filter((t) => (
          t.responsible_id !== user.id
          && (t.created_by === user.id || t.assignees.some((a) => a.user_id === user.id))
        ))
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.title.toLowerCase().includes(q))
    }
    return list
  }, [source.tasks, subTab, search, user])

  /** Counts on the tabs, so a handoff is visible without switching to look. */
  const tabCounts = useMemo(() => {
    if (!user) return { desk: 0, involved: 0, all: source.tasks.length }
    return {
      desk: source.tasks.filter((t) => t.responsible_id === user.id).length,
      involved: source.tasks.filter((t) => (
        t.responsible_id !== user.id
        && (t.created_by === user.id || t.assignees.some((a) => a.user_id === user.id))
      )).length,
      all: source.tasks.length,
    }
  }, [source.tasks, user])

  // Keep the open drawer's task in sync with the latest data.
  const liveSelected = selected ? (active.tasks.find((t) => t.id === selected.id) ?? completed.tasks.find((t) => t.id === selected.id) ?? selected) : null

  // ── Action handlers with confirmation toasts ──────────────────────────────
  const handleCreate = useCallback(async (payload: Parameters<typeof active.createTask>[0]) => {
    const task = await active.createTask(payload)
    showToast('Task created')
    return task
  }, [active, showToast])

  const handleMoveStage = useCallback((id: string, stageId: string, responsibleId?: string | null) => {
    const stage = defaultStages.find((s) => s.id === stageId)
    active.moveToStage(id, stageId, responsibleId)
      .then((task) => {
        // The toast reports what actually happened, including who ended up with
        // it — the stage rule may have chosen someone other than the mover.
        const holder = task.responsible?.name ?? task.responsible?.email ?? null
        if (stage?.requires_approval) showToast(`Sent to ${stage.name} for sign-off`)
        else if (holder && task.responsible_id !== user?.id) showToast(`Moved to ${stage?.name ?? 'a new stage'} — now with ${holder}`)
        else showToast(stage ? `Moved to ${stage.name}` : 'Task moved')
      })
      .catch((e: unknown) => showToast(e instanceof Error ? e.message : 'That move didn’t go through.'))
  }, [active, defaultStages, showToast, user])

  const handleSetResponsible = useCallback(async (id: string, userId: string | null) => {
    const task = await active.setResponsible(id, userId)
    const holder = task.responsible?.name ?? task.responsible?.email ?? null
    showToast(holder ? `Now with ${holder}` : 'Taken off everyone’s desk')
    return task
  }, [active, showToast])

  const handleRule = useCallback(async (id: string, payload: Parameters<typeof active.ruleOnTask>[1]) => {
    const task = await active.ruleOnTask(id, payload)
    showToast(payload.decision === 'approved'
      ? (task.done ? 'Approved — task complete' : 'Approved and moved on')
      : 'Sent back for changes')
    // Approving the last stage finishes the task, which drops it out of the
    // active list — leaving the drawer open would show a row that no longer
    // refreshes. Everything else stays open so the trail can be read.
    if (task.done) setSelected(null)
    return task
  }, [active, showToast])

  // Completing is a way of leaving a stage, so a gate can refuse it. The toast
  // only claims success once the write has actually landed.
  const handleComplete = useCallback((id: string) => {
    active.toggleDone(id)
      .then(() => showToast('Task completed', { action: { label: 'Undo', onClick: () => void completed.toggleDone(id) } }))
      .catch((e: unknown) => showToast(e instanceof Error ? e.message : 'Couldn’t complete that task.'))
  }, [active, completed, showToast])

  const handleToggleDone = useCallback((id: string) => {
    const wasDone = source.tasks.find((t) => t.id === id)?.done ?? false
    source.toggleDone(id)
      .then(() => showToast(wasDone ? 'Marked as not done' : 'Task completed'))
      .catch((e: unknown) => showToast(e instanceof Error ? e.message : 'Couldn’t update that task.'))
  }, [source, showToast])

  const handleDelete = useCallback(async (id: string) => {
    await source.deleteTask(id)
    showToast('Task deleted')
  }, [source, showToast])

  const handleSetAssignees = useCallback(async (id: string, ids: string[]) => {
    await source.setAssignees(id, ids)
    showToast('Assignees updated')
  }, [source, showToast])

  return (
    <div className="p-4 lg:p-8 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Tasks</h1>
      </div>

      {/* View tabs — scroll rather than wrap once they outgrow a phone. */}
      <div className="flex items-center gap-1 border-b border-gray-100 mb-4 overflow-x-auto scrollbar-none">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex-shrink-0 ${
              view === v.key ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
            style={view === v.key ? { color: 'var(--accent, #ED64A6)' } : {}}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Toolbar. Insights reads its own aggregated data, so the list filters
          (personal/all, search) don't apply there. */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {isListView(view) && (
          <>
            {/* Sub-tabs */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {SUB_TABS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSubTab(s.key)}
                  aria-pressed={subTab === s.key}
                  className={`px-3 min-h-[36px] rounded-md text-xs2 font-medium transition-colors whitespace-nowrap ${subTab === s.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                >
                  {s.label}
                  <span className={`ml-1.5 ${subTab === s.key ? 'text-gray-400' : 'text-gray-400'}`}>{tabCounts[s.key]}</span>
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[140px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
              />
            </div>
          </>
        )}

        {/* Not board-only: stages now carry the handoff and sign-off rules, which
            matter just as much from the list. Hiding this behind the Board tab
            put the one screen that configures the workflow somewhere most
            people never look. */}
        {isListView(view) && defaultWorkflow && (
          <button
            onClick={() => setShowWorkflow(true)}
            title="Set who picks work up at each stage, and what needs signing off"
            className="flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-lg border border-gray-200 text-xs2 font-medium text-gray-500 hover:border-gray-300 flex-shrink-0"
          >
            <SlidersHorizontal size={14} /> Stages &amp; rules
          </button>
        )}

        <button
          onClick={() => setShowNew(true)}
          className="press flex items-center gap-1.5 px-4 py-2 text-white rounded-full text-sm font-semibold hover:opacity-90 ml-auto"
          style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
        >
          <Plus size={15} /> Add task
        </button>
      </div>

      {/* Content */}
      {view === 'insights' ? (
        <InsightsPanel workspaceId={wsId} accent={settings.accent_color ?? '#ED64A6'} />
      ) : source.loading ? (
        // Shaped to the view being opened, so the page doesn't reflow on swap.
        view === 'board' ? <TaskBoardSkeleton />
          : view === 'table' ? <TaskTableSkeleton />
            : <TaskRowsSkeleton />
      ) : source.error ? (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-sm text-gray-500 mb-3">{source.error}</p>
          <button onClick={() => void source.refetch()} className="text-sm font-semibold" style={{ color: 'var(--accent, #ED64A6)' }}>Try again</button>
        </div>
      ) : view === 'board' ? (
        <TaskBoardView
          tasks={filtered}
          stages={defaultStages}
          onMoveStage={handleMoveStage}
          onComplete={handleComplete}
          onOpen={setSelected}
          workspaceId={wsId}
          currentUserId={user?.id ?? null}
          canManage={canManage}
          onBlocked={(message) => showToast(message)}
        />
      ) : view === 'table' ? (
        <TaskTableView tasks={filtered} onToggleDone={handleToggleDone} onOpen={setSelected} />
      ) : (
        <TaskListView tasks={filtered} grouped={subTab === 'all'} onToggleDone={handleToggleDone} onOpen={setSelected} />
      )}

      {/* Drawer */}
      {liveSelected && (
        <TaskDetailDrawer
          task={liveSelected}
          workspaceId={wsId}
          stages={defaultStages}
          onPatch={source.patchTask}
          onSetAssignees={handleSetAssignees}
          onAddSubtask={source.addSubtask}
          onToggleSubtask={source.toggleSubtask}
          onRenameSubtask={source.renameSubtask}
          onDeleteSubtask={source.deleteSubtask}
          onAddFile={source.addFile}
          onRemoveFile={source.removeFile}
          onToggleDone={(id) => { handleToggleDone(id); setSelected(null) }}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
          currentUserId={user?.id ?? null}
          canManage={canManage}
          onSetResponsible={handleSetResponsible}
          onRule={handleRule}
        />
      )}

      {/* New task */}
      {showNew && (
        <NewTaskModal
          workspaceId={wsId}
          stages={defaultStages}
          onCreate={async (payload) => {
            // Open the detail panel right away so the rest of the task
            // (description, subtasks, files) can be filled in one flow.
            const task = await handleCreate(payload)
            setSelected(task)
            return task
          }}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* Board stage editor */}
      {showWorkflow && defaultWorkflow && (
        <WorkflowEditorModal
          workflow={defaultWorkflow}
          workspaceId={wsId}
          onAddStage={addStage}
          onUpdateStage={updateStage}
          onDeleteStage={deleteStage}
          onReorderStages={reorderStages}
          onClose={() => setShowWorkflow(false)}
        />
      )}
    </div>
  )
}
