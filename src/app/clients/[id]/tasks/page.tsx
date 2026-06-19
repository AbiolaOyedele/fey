'use client'

import { use, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useTasks } from '@/hooks/useTasks'
import { useWorkflows } from '@/hooks/useWorkflows'
import TaskListView from '@/components/tasks/TaskListView'
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer'
import NewTaskModal from '@/components/tasks/NewTaskModal'
import type { Task } from '@/types/work-tasks'

/**
 * Client Tasks tab — every task linked to this client, including tasks that
 * belong to the client's projects (contact_id is denormalized onto each task).
 */
export default function ClientTasksTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { workspace } = useWorkspace()
  const wsId = workspace?.id ?? null

  const [selected, setSelected] = useState<Task | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const tasks = useTasks({ scope: 'contact', contactId: id, workspaceId: wsId, ...(showDone ? {} : { done: false }) })
  const { workflows } = useWorkflows(wsId)
  const stages = (workflows.find((w) => w.is_default) ?? workflows[0])?.stages ?? []

  const live = selected ? (tasks.tasks.find((t) => t.id === selected.id) ?? selected) : null
  const done = tasks.tasks.filter((t) => t.done).length
  const pending = tasks.tasks.length - done

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-400">{tasks.loading ? '…' : `${pending} pending · ${done} completed`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDone((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs2 font-medium border transition-colors ${showDone ? 'border-transparent text-white' : 'border-gray-200 text-gray-500'}`}
            style={showDone ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
          >
            {showDone ? 'All' : 'Active'}
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-white rounded-full text-sm font-semibold hover:opacity-90"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            <Plus size={14} /> Add task
          </button>
        </div>
      </div>

      {tasks.loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : tasks.error ? (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-sm text-gray-500 mb-2">{tasks.error}</p>
          <button onClick={() => void tasks.refetch()} className="text-sm font-semibold" style={{ color: 'var(--accent, #ED64A6)' }}>Try again</button>
        </div>
      ) : (
        <TaskListView tasks={tasks.tasks} grouped onToggleDone={tasks.toggleDone} onOpen={setSelected} />
      )}

      {live && (
        <TaskDetailDrawer
          task={live}
          workspaceId={wsId}
          stages={stages}
          onPatch={tasks.patchTask}
          onSetAssignees={tasks.setAssignees}
          onAddSubtask={tasks.addSubtask}
          onToggleSubtask={tasks.toggleSubtask}
          onDeleteSubtask={tasks.deleteSubtask}
          onToggleDone={(tid) => { tasks.toggleDone(tid); setSelected(null) }}
          onDelete={tasks.deleteTask}
          onClose={() => setSelected(null)}
        />
      )}

      {showNew && (
        <NewTaskModal workspaceId={wsId} fixedContactId={id} onCreate={tasks.createTask} onClose={() => setShowNew(false)} />
      )}
    </div>
  )
}
