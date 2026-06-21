'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Loader2, User, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
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

type View = 'list' | 'board' | 'table' | 'completed'
type Scope = 'personal' | 'team' | 'all'

const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'list', label: 'Tasks' },
  { key: 'board', label: 'Board' },
  { key: 'table', label: 'Table' },
  { key: 'completed', label: 'Completed' },
]

export default function TasksPage() {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  const wsId = workspace?.id ?? null

  const [view, setView] = useState<View>('list')
  const [scope, setScope] = useState<Scope>('all')
  const [search, setSearch] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [selected, setSelected] = useState<Task | null>(null)
  const [showNew, setShowNew] = useState(false)

  const taskScope = scope
  const active = useTasks({ scope: taskScope, workspaceId: wsId, done: false })
  const completed = useTasks({ scope: taskScope, workspaceId: wsId, done: true })
  const { workflows, addStage, updateStage, deleteStage, reorderStages } = useWorkflows(wsId)

  const [showWorkflow, setShowWorkflow] = useState(false)
  const defaultWorkflow = useMemo(() => workflows.find((w) => w.is_default) ?? workflows[0] ?? null, [workflows])
  const defaultStages = defaultWorkflow?.stages ?? []

  const source = view === 'completed' ? completed : active
  const filtered = useMemo(() => {
    let list = source.tasks
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.title.toLowerCase().includes(q))
    }
    if (onlyMine && user) list = list.filter((t) => t.created_by === user.id || t.assignees.some((a) => a.user_id === user.id))
    return list
  }, [source.tasks, search, onlyMine, user])

  // Keep the open drawer's task in sync with the latest data.
  const liveSelected = selected ? (active.tasks.find((t) => t.id === selected.id) ?? completed.tasks.find((t) => t.id === selected.id) ?? selected) : null

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
        {/* Scope */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['personal', 'team', 'all'] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 rounded-md text-xs2 font-medium capitalize transition-colors ${scope === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              {s === 'personal' ? 'Personal' : s === 'team' ? 'Team' : 'All'}
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

        <button
          onClick={() => setOnlyMine((v) => !v)}
          title={onlyMine ? 'Showing my tasks' : 'Showing everyone'}
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs2 font-medium transition-colors ${onlyMine ? 'border-transparent text-white' : 'border-gray-200 text-gray-500'}`}
          style={onlyMine ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
        >
          {onlyMine ? <User size={14} /> : <Users size={14} />}
          {onlyMine ? 'Mine' : 'Everyone'}
        </button>

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
          className="flex items-center gap-1.5 px-4 py-2 text-white rounded-full text-sm font-semibold hover:opacity-90 ml-auto"
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
        <TaskBoardView tasks={filtered} stages={defaultStages} onMoveStage={active.moveToStage} onOpen={setSelected} />
      ) : view === 'table' ? (
        <TaskTableView tasks={filtered} onToggleDone={source.toggleDone} onOpen={setSelected} />
      ) : (
        <TaskListView tasks={filtered} grouped={scope === 'all'} onToggleDone={source.toggleDone} onOpen={setSelected} />
      )}

      {/* Drawer */}
      {liveSelected && (
        <TaskDetailDrawer
          task={liveSelected}
          workspaceId={wsId}
          stages={defaultStages}
          onPatch={source.patchTask}
          onSetAssignees={source.setAssignees}
          onAddSubtask={source.addSubtask}
          onToggleSubtask={source.toggleSubtask}
          onDeleteSubtask={source.deleteSubtask}
          onToggleDone={(id) => { source.toggleDone(id); setSelected(null) }}
          onDelete={source.deleteTask}
          onClose={() => setSelected(null)}
        />
      )}

      {/* New task */}
      {showNew && (
        <NewTaskModal
          workspaceId={wsId}
          onCreate={active.createTask}
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
