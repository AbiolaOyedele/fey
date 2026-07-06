'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Task, WorkflowStage } from '@/types/work-tasks'
import { AssigneeAvatars, DueChip, PriorityFlag, formatMinutes } from './TaskBits'

interface TaskBoardViewProps {
  tasks: Task[]
  stages: WorkflowStage[]
  onMoveStage: (taskId: string, stageId: string) => void
  /** Dropping a card into the trailing "Completed" column marks the task done. */
  onComplete: (taskId: string) => void
  onOpen: (task: Task) => void
}

const UNASSIGNED = '__none__'
const COMPLETED = '__done__'

export default function TaskBoardView({ tasks, stages, onMoveStage, onComplete, onOpen }: TaskBoardViewProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const columns = useMemo(() => {
    const byStage = new Map<string, Task[]>()
    stages.forEach((s) => byStage.set(s.id, []))
    byStage.set(UNASSIGNED, [])
    for (const t of tasks) {
      const key = t.stage_id && byStage.has(t.stage_id) ? t.stage_id : UNASSIGNED
      byStage.get(key)!.push(t)
    }
    const cols = stages.map((s) => ({ id: s.id, name: s.name, color: s.color, tasks: byStage.get(s.id) ?? [] }))
    const orphans = byStage.get(UNASSIGNED) ?? []
    if (orphans.length) cols.unshift({ id: UNASSIGNED, name: 'Unscheduled', color: '#CBD5E1', tasks: orphans })
    // Always-present trailing drop target — completed tasks leave the active
    // list (see useTasks.toggleDone), so this column is intentionally never
    // populated; it exists purely to catch drags.
    cols.push({ id: COMPLETED, name: 'Completed', color: '#22C55E', tasks: [] })
    return cols
  }, [tasks, stages])

  const onDragEnd = (e: DragEndEvent) => {
    const taskId = String(e.active.id)
    const target = e.over ? String(e.over.id) : null
    if (!target || target === UNASSIGNED) return
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    if (target === COMPLETED) { onComplete(taskId); return }
    if (task.stage_id !== target) onMoveStage(taskId, target)
  }

  if (stages.length === 0) {
    return <p className="text-sm text-gray-400 py-10 text-center">No workflow stages configured.</p>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => (
          col.id === COMPLETED
            ? <CompletedColumn key={col.id} col={col} />
            : <Column key={col.id} col={col} onOpen={onOpen} />
        ))}
      </div>
    </DndContext>
  )
}

function CompletedColumn({ col }: { col: { id: string; name: string; color: string; tasks: Task[] } }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div className="w-72 flex-shrink-0">
      <div className="flex items-center gap-2 px-1 mb-2">
        <Check size={13} style={{ color: col.color }} />
        <span className="text-sm font-semibold text-gray-700">{col.name}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[120px] rounded-2xl p-2 border-2 border-dashed transition-colors flex items-center justify-center ${
          isOver ? 'bg-green-50 border-green-300' : 'border-gray-200'
        }`}
      >
        <p className="text-xs2 text-gray-400 text-center px-2">Drop a task here to mark it complete</p>
      </div>
    </div>
  )
}

function Column({ col, onOpen }: { col: { id: string; name: string; color: string; tasks: Task[] }; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div className="w-72 flex-shrink-0">
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
        <span className="text-sm font-semibold text-gray-700">{col.name}</span>
        <span className="text-xs2 text-gray-400">{col.tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[120px] rounded-2xl p-2 transition-colors ${isOver ? 'bg-gray-100' : 'bg-gray-50/60'}`}
      >
        {col.tasks.map((t) => <Card key={t.id} task={t} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

function Card({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 cursor-grab active:cursor-grabbing"
    >
      <p className={`text-sm font-medium mb-2 ${task.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
      {(task.project_title || task.contact_name) && (
        <p className="text-2xs text-gray-400 truncate mb-2">{task.project_title ?? task.contact_name}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AssigneeAvatars assignees={task.assignees} size={20} />
          <PriorityFlag priority={task.priority} />
        </div>
        <div className="flex items-center gap-2">
          <DueChip due={task.due_date} done={task.done} />
          {task.estimated_minutes != null && <span className="text-2xs text-gray-400">{formatMinutes(task.estimated_minutes)}</span>}
        </div>
      </div>
    </div>
  )
}
