'use client'

import { useMemo, useState } from 'react'
import { Check, ShieldCheck, Lock, Clock } from 'lucide-react'
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Task, WorkflowStage } from '@/types/work-tasks'
import { isStale, daysInStage, needsSignOff, canRule } from '@/types/work-tasks'
import { AssigneeAvatars, DueChip, PriorityFlag, formatMinutes } from './TaskBits'
import HandoffPrompt from './HandoffPrompt'

interface TaskBoardViewProps {
  tasks: Task[]
  stages: WorkflowStage[]
  /** `responsibleId` is only sent when the target stage asks who's taking it on. */
  onMoveStage: (taskId: string, stageId: string, responsibleId?: string | null) => void
  /** Dropping a card into the trailing "Completed" column marks the task done. */
  onComplete: (taskId: string) => void
  onOpen: (task: Task) => void
  workspaceId: string | null | undefined
  currentUserId: string | null
  /** Whether the viewer can manage the workspace — the fallback approver. */
  canManage: boolean
  /** Surfaces a refused move (a gated stage) as a message, not a silent snap-back. */
  onBlocked?: (message: string) => void
}

const UNASSIGNED = '__none__'
const COMPLETED = '__done__'

interface Column {
  id: string
  name: string
  color: string
  tasks: Task[]
  stage: WorkflowStage | null
}

export default function TaskBoardView({
  tasks, stages, onMoveStage, onComplete, onOpen, workspaceId, currentUserId, canManage, onBlocked,
}: TaskBoardViewProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  // A move into a stage that asks who's next is held here until someone is picked.
  const [pending, setPending] = useState<{ task: Task; stage: WorkflowStage } | null>(null)

  const columns = useMemo<Column[]>(() => {
    const byStage = new Map<string, Task[]>()
    stages.forEach((s) => byStage.set(s.id, []))
    byStage.set(UNASSIGNED, [])
    for (const t of tasks) {
      const key = t.stage_id && byStage.has(t.stage_id) ? t.stage_id : UNASSIGNED
      byStage.get(key)!.push(t)
    }
    const cols: Column[] = stages.map((s) => ({ id: s.id, name: s.name, color: s.color, tasks: byStage.get(s.id) ?? [], stage: s }))
    const orphans = byStage.get(UNASSIGNED) ?? []
    if (orphans.length) cols.unshift({ id: UNASSIGNED, name: 'Unscheduled', color: '#CBD5E1', tasks: orphans, stage: null })
    // Always-present trailing drop target — completed tasks leave the active
    // list (see useTasks.toggleDone), so this column is intentionally never
    // populated; it exists purely to catch drags.
    cols.push({ id: COMPLETED, name: 'Completed', color: '#22C55E', tasks: [], stage: null })
    return cols
  }, [tasks, stages])

  /**
   * Whether the viewer may take this task out of where it currently sits.
   * Mirrors the server's gate so a refused drag is explained rather than just
   * springing back to its column.
   */
  const canLeaveCurrentStage = (task: Task): { ok: true } | { ok: false; message: string } => {
    const from = stages.find((s) => s.id === task.stage_id) ?? null
    if (!needsSignOff(task, from)) return { ok: true }
    if (canRule(from, currentUserId, canManage)) return { ok: true }
    return { ok: false, message: `“${task.title}” is waiting for sign-off in ${from!.name}. Open it to see who reviews that stage.` }
  }

  const onDragEnd = (e: DragEndEvent) => {
    const taskId = String(e.active.id)
    const target = e.over ? String(e.over.id) : null
    if (!target || target === UNASSIGNED) return
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const gate = canLeaveCurrentStage(task)
    if (!gate.ok) { onBlocked?.(gate.message); return }

    if (target === COMPLETED) { onComplete(taskId); return }
    if (task.stage_id === target) return

    const toStage = stages.find((s) => s.id === target)
    // "Ask" stages hold the move open until someone is named — dropping the card
    // and then being asked is the right order: the drag already said where.
    if (toStage?.handoff_mode === 'prompt') { setPending({ task, stage: toStage }); return }
    onMoveStage(taskId, target)
  }

  if (stages.length === 0) {
    return <p className="text-sm text-gray-400 py-10 text-center">No workflow stages configured.</p>
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => (
            col.id === COMPLETED
              ? <CompletedColumn key={col.id} col={col} />
              : <BoardColumn key={col.id} col={col} onOpen={onOpen} />
          ))}
        </div>
      </DndContext>

      {pending && (
        // Same sheet the drawer uses, so a stage set to ask behaves identically
        // however the task got moved — and picking someone is one tap, not three.
        <HandoffPrompt
          taskTitle={pending.task.title}
          stageName={pending.stage.name}
          currentHolderId={pending.task.responsible_id}
          workspaceId={workspaceId}
          onChoose={(userId) => {
            onMoveStage(pending.task.id, pending.stage.id, userId)
            setPending(null)
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  )
}

function CompletedColumn({ col }: { col: Column }) {
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

function BoardColumn({ col, onOpen }: { col: Column; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div className="w-72 flex-shrink-0">
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
        <span className="text-sm font-semibold text-gray-700 truncate">{col.name}</span>
        {col.stage?.requires_approval && (
          <ShieldCheck size={12} className="text-amber-500 flex-shrink-0" aria-label="Needs sign-off to leave" />
        )}
        <span className="text-xs2 text-gray-400 flex-shrink-0">{col.tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[120px] rounded-2xl p-2 transition-colors ${isOver ? 'bg-gray-100' : 'bg-gray-50/60'}`}
      >
        {col.tasks.map((t) => <Card key={t.id} task={t} stage={col.stage} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

function Card({ task, stage, onOpen }: { task: Task; stage: WorkflowStage | null; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 } : undefined
  const waiting = needsSignOff(task, stage)
  const stalled = isStale(task, stage)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 cursor-grab active:cursor-grabbing transition-shadow duration-150 hover:shadow-md hover:border-gray-200"
    >
      <p className={`text-sm font-medium mb-2 break-words ${task.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
      {(task.project_title || task.contact_name) && (
        <p className="text-2xs text-gray-400 truncate mb-2">{task.project_title ?? task.contact_name}</p>
      )}

      {(waiting || stalled) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {waiting && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-amber-50 text-amber-700">
              <Lock size={9} /> Awaiting sign-off
            </span>
          )}
          {stalled && !waiting && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-orange-50 text-orange-700">
              <Clock size={9} /> {daysInStage(task)}d here
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* The holder leads — the board's job is to answer "whose is this now",
              and a row of every assignee buries that. */}
          <AssigneeAvatars assignees={task.responsible ? [task.responsible] : []} size={20} />
          <PriorityFlag priority={task.priority} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <DueChip due={task.due_date} done={task.done} />
          {task.estimated_minutes != null && <span className="text-2xs text-gray-400">{formatMinutes(task.estimated_minutes)}</span>}
        </div>
      </div>
    </div>
  )
}
