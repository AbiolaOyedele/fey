'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Loader2 } from 'lucide-react'
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
import { SlidersHorizontal } from 'lucide-react'
import type { Task } from '@/types/work-tasks'

type View = 'board' | 'table' | 'list' | 'completed'
type SubTab = 'personal' | 'all'

const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'board', label: 'Board' },
  { key: 'table', label: 'Table' },
  { key: 'list', label: 'List' },
  { key: 'completed', label: 'Completed' },
]

export default function TasksPage() {
  const { user } = useAuth()
  const { showToast } = useSettings()
  const { workspace } = useWorkspace()
  const wsId = workspace?.id ?? null
  const searchParams = useSearchParams()
  const deepLinkTaskId = searchParams.get('taskId')

  const [view, setView] = useState<View>('list')
  const [subTab, setSubTab] = useState<SubTab>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Task | null>(null)
  const [showNew, setShowNew] = useState(false)

  // Fetch the full workspace-wide set (server-scoped by role: admins get every
  // task, members get theirs + team-visible). The Personal sub-tab narrows this
  // to the current user's own tasks client-side.
  const active = useTasks({ scope: 'all', workspaceId: wsId, done: false })
  const completed = useTasks({ scope: 'all', workspaceId: wsId, done: true })
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
    // Personal: only tasks the current user created or is assigned to.
    if (subTab === 'personal' && user) {
      list = list.filter((t) => t.created_by === user.id || t.assignees.some((a) => a.user_id === user.id))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.title.toLowerCase().includes(q))
    }
    return list
  }, [source.tasks, subTab, search, user])

  // Keep the open drawer's task in sync with the latest data.
  const liveSelected = selected ? (active.tasks.find((t) => t.id === selected.id) ?? completed.tasks.find((t) => t.id === selected.id) ?? selected) : null

  // ── Action handlers with confirmation toasts ──────────────────────────────
  const handleCreate = useCallback(async (payload: Parameters<typeof active.createTask>[0]) => {
    const task = await active.createTask(payload)
    showToast('Task created')
    return task
  }, [active, showToast])

  const handleMoveStage = useCallback((id: string, stageId: string) => {
    void active.moveToStage(id, stageId)
    const name = defaultStages.find((s) => s.id === stageId)?.name
    showToast(name ? `Moved to ${name}` : 'Task moved')
  }, [active, defaultStages, showToast])

  const handleComplete = useCallback((id: string) => {
    void active.toggleDone(id)
    showToast('Task completed', { action: { label: 'Undo', onClick: () => void completed.toggleDone(id) } })
  }, [active, completed, showToast])

  const handleToggleDone = useCallback((id: string) => {
    const wasDone = source.tasks.find((t) => t.id === id)?.done ?? false
    void source.toggleDone(id)
    showToast(wasDone ? 'Marked as not done' : 'Task completed')
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

      {/* View tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100 mb-4">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === v.key ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
            style={view === v.key ? { color: 'var(--accent, #ED64A6)' } : {}}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Sub-tabs */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['personal', 'all'] as SubTab[]).map((s) => (
            <button
              key={s}
              onClick={() => setSubTab(s)}
              className={`px-3 py-1.5 rounded-md text-xs2 font-medium transition-colors ${subTab === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              {s === 'personal' ? 'Personal' : 'All'}
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

        {view === 'board' && defaultWorkflow && (
          <button
            onClick={() => setShowWorkflow(true)}
            title="Customize board stages"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-gray-200 text-xs2 font-medium text-gray-500 hover:border-gray-300"
          >
            <SlidersHorizontal size={14} /> Stages
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
      {source.loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : source.error ? (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-sm text-gray-500 mb-3">{source.error}</p>
          <button onClick={() => void source.refetch()} className="text-sm font-semibold" style={{ color: 'var(--accent, #ED64A6)' }}>Try again</button>
        </div>
      ) : view === 'board' ? (
        <TaskBoardView tasks={filtered} stages={defaultStages} onMoveStage={handleMoveStage} onComplete={handleComplete} onOpen={setSelected} />
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
