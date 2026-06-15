'use client'

import { useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ChevronDown, CheckCircle2, Clock,
  AlertTriangle, X, ListTodo, Check, Calendar, Trash2, GripVertical,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useFeyData } from '@/hooks/useFeyData'
import { getContrastColor } from '@/utils/colorContrast'
import { PALETTE } from '@/data/defaultClients'
import type { FeyTask, FeyThreadWithTasks } from '@/types'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import type { DraggableAttributes } from '@dnd-kit/core'

const TASK_FILTER_OPTIONS = [
  { value: 'all',     label: 'All Tasks' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today',   label: 'Due Today' },
] as const

type TaskFilter = typeof TASK_FILTER_OPTIONS[number]['value']

function getTodayStr(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatDeadlineFull(dateStr: string): string {
  return formatDate(dateStr)
}

function daysDiff(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000)
}

// ── Task row ───────────────────────────────────────────────────────────────────

interface FeyTaskItemProps {
  task: FeyTask
  onUpdate: (task: FeyTask) => void
  onDelete: (taskId: string) => void
  onOpenNotes: (task: FeyTask) => void
  dragListeners?: SyntheticListenerMap | undefined
  dragAttributes?: DraggableAttributes | undefined
}

function FeyTaskItem({ task, onUpdate, onDelete, onOpenNotes, dragListeners, dragAttributes }: FeyTaskItemProps) {
  const [editing,  setEditing]  = useState(false)
  const [titleVal, setTitleVal] = useState(task.title)
  const [deleting, setDeleting] = useState(false)
  const [hovered,  setHovered]  = useState(false)

  const todayStr  = getTodayStr()
  const isOverdue = Boolean(task.deadline && !task.done && task.deadline < todayStr)
  const isToday   = Boolean(task.deadline && !task.done && task.deadline === todayStr)

  function fmtDeadline(d: string): string {
    return formatDate(d + 'T00:00:00')
  }

  const handleDone = () => onUpdate({ ...task, done: !task.done })

  const handleTitleBlur = () => {
    setEditing(false)
    const t = titleVal.trim()
    if (t && t !== task.title) { setTitleVal(t); onUpdate({ ...task, title: t }) }
    else setTitleVal(task.title)
  }

  const handleDeadlineChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onUpdate({ ...task, deadline: e.target.value || null })

  const handleDelete = () => {
    setDeleting(true)
    setTimeout(() => onDelete(task.id), 200)
  }

  return (
    <div
      className={`group/row transition-all duration-150 ${deleting ? 'opacity-0' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl group-hover/row:bg-gray-50 transition-colors duration-150">
        {isOverdue && (
          <div className="w-0.5 h-4 rounded-full bg-red-400 flex-shrink-0" />
        )}

        <span
          onClick={handleDone}
          role="checkbox"
          aria-checked={task.done}
          className={`rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-150 ${task.done ? 'text-white' : 'border-gray-200'}`}
          style={{
            width: 18, height: 18,
            ...(task.done ? { backgroundColor: 'var(--accent,#ED64A6)', borderColor: 'var(--accent,#ED64A6)' } : {}),
          }}
          onMouseEnter={(e) => { if (!task.done) e.currentTarget.style.borderColor = 'var(--accent,#ED64A6)' }}
          onMouseLeave={(e) => { if (!task.done) e.currentTarget.style.borderColor = '' }}
        >
          {task.done && <Check size={10} strokeWidth={3} />}
        </span>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              className="w-full bg-transparent outline-none text-sm border-b border-gray-200 pb-px"
            />
          ) : (
            <p
              onClick={() => setEditing(true)}
              className={`text-sm cursor-text truncate leading-snug ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}
            >
              {task.title}
            </p>
          )}
        </div>

        {task.deadline && (
          <span className={`flex-shrink-0 text-2xs font-medium px-1.5 py-0.5 rounded-md leading-none ${
            isOverdue ? 'bg-red-50 text-red-500' : isToday ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'
          }`}>
            {fmtDeadline(task.deadline)}
          </span>
        )}

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <div
            className={`relative w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              isOverdue ? 'text-red-400 hover:bg-red-50'
              : task.deadline ? 'text-amber-400 hover:bg-amber-50'
              : 'opacity-0 group-hover/row:opacity-100 text-gray-300 hover:bg-gray-100 hover:text-gray-500'
            }`}
            title={task.deadline ? `Due: ${fmtDeadline(task.deadline)}` : 'Set deadline'}
          >
            <Calendar size={13} className="pointer-events-none" />
            <input
              type="date"
              value={task.deadline ?? ''}
              onChange={handleDeadlineChange}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              tabIndex={-1}
            />
          </div>

          <button
            onClick={handleDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover/row:opacity-100 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all"
          >
            <Trash2 size={13} />
          </button>

          {dragListeners && (
            <button
              {...dragListeners}
              {...dragAttributes}
              className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover/row:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing touch-none text-gray-300 transition-opacity"
              tabIndex={-1}
            >
              <GripVertical size={13} />
            </button>
          )}
        </div>
      </div>

      {task.notes && (
        <div
          className="grid transition-all duration-200 ease-in-out"
          style={{ gridTemplateRows: hovered ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div
              onClick={() => onOpenNotes(task)}
              className="px-3 pb-3 pt-0.5 pl-10 cursor-pointer"
            >
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 hover:text-gray-600 transition-colors">
                {task.notes}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sortable wrapper ───────────────────────────────────────────────────────────

interface DraggableFeyTaskProps {
  task: FeyTask
  onUpdate: (task: FeyTask) => void
  onDelete: (taskId: string) => void
  onOpenNotes: (task: FeyTask) => void
}

function DraggableFeyTask({ task, onUpdate, onDelete, onOpenNotes }: DraggableFeyTaskProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style}>
      <FeyTaskItem
        task={task}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onOpenNotes={onOpenNotes}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
}

// ── Notes panel ────────────────────────────────────────────────────────────────

interface NotesPanelProps {
  task: FeyTask
  accent: string
  todayStr: string
  onClose: () => void
}

function NotesPanel({ task, todayStr, onClose }: NotesPanelProps) {
  const isOverdue = Boolean(task.deadline && !task.done && task.deadline < todayStr)
  const isToday   = Boolean(task.deadline && !task.done && task.deadline === todayStr)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col p-6">
        <div className="flex items-start justify-between mb-5">
          <h3 className="font-display text-lg font-bold text-gray-900 leading-tight pr-4">
            {task.title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {task.notes && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
            <p className="text-sm text-gray-700 leading-relaxed">{task.notes}</p>
          </div>
        )}

        {task.deadline && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Deadline</p>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${isOverdue ? 'text-red-500' : 'text-gray-700'}`}>
                {formatDeadlineFull(task.deadline)}
                {isOverdue && ` · ${daysDiff(task.deadline)}d overdue`}
                {isToday && ' · Due today'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function filterTaskList(tasks: FeyTask[], filter: TaskFilter, todayStr: string): FeyTask[] {
  if (filter === 'overdue') return tasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr)
  if (filter === 'today')   return tasks.filter((t) => t.deadline === todayStr)
  return tasks
}

export default function FeyWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const { settings } = useSettings()
  const accent   = settings.accent_color || '#ED64A6'
  const todayStr = getTodayStr()

  const { threads, loading, updateTask, deleteTask } = useFeyData(user?.id)
  const thread = threads.find((t) => t.id === id) as FeyThreadWithTasks | undefined

  const [taskFilter,         setTaskFilter]         = useState<TaskFilter>('all')
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [filterPos,          setFilterPos]          = useState({ top: 0, left: 0 })
  const [notesTask,          setNotesTask]          = useState<FeyTask | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const threadIndex = threads.findIndex((t) => t.id === id)
  const color     = PALETTE[threadIndex >= 0 ? threadIndex % PALETTE.length : 0]
  const textColor = thread ? getContrastColor(color) : '#000'

  const handleUpdate = useCallback((updated: FeyTask) => {
    void updateTask(updated.id, { title: updated.title, done: updated.done, deadline: updated.deadline })
  }, [updateTask])

  const handleDelete = useCallback((taskId: string) => {
    void deleteTask(taskId)
  }, [deleteTask])

  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    // sort_order update not implemented in useFeyData — placeholder
  }, [])

  if (loading) {
    return (
      <div className="p-8 page-enter">
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse mb-6" />
        <div className="bg-white rounded-2xl h-48 animate-pulse" />
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="p-8 page-enter text-center py-20">
        <p className="text-gray-400 text-lg">Thread not found</p>
        <button
          onClick={() => router.push('/fey')}
          className="text-sm mt-2 hover:underline"
          style={{ color: accent }}
        >
          Back to Fey
        </button>
      </div>
    )
  }

  const allTasks       = [...thread.tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const overdueTasks   = allTasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr)
  const pendingTasks   = filterTaskList(allTasks.filter((t) => !t.done), taskFilter, todayStr)
  const completedTasks = filterTaskList(allTasks.filter((t) => t.done), taskFilter, todayStr)
  const completionPct  = allTasks.length > 0
    ? Math.round((allTasks.filter((t) => t.done).length / allTasks.length) * 100)
    : 0
  const currentFilterLabel = TASK_FILTER_OPTIONS.find((o) => o.value === taskFilter)?.label ?? 'All Tasks'

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-enter overflow-hidden max-w-full">

      {/* ── Main content ── */}
      <div className="flex-1 p-4 lg:p-8 lg:pr-4 min-w-0 overflow-y-auto overflow-x-hidden">

        <button
          onClick={() => router.push('/fey')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Fey
        </button>

        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: color }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/50 flex-shrink-0 font-display font-bold text-2xl"
              style={{ color: textColor }}
            >
              {new Date(thread.message_date + 'T00:00:00').getDate()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl leading-tight font-bold truncate" style={{ color: textColor }}>
                {formatDate(thread.message_date)}
              </h1>
              <p className="text-sm mt-0.5 line-clamp-1" style={{ color: textColor, opacity: 0.65 }}>
                {thread.heading}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-gray-800">
            Tasks
            <span className="text-sm font-normal text-gray-400 ml-2">{allTasks.length}</span>
          </h2>

          <div className="relative">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setFilterPos({ top: rect.bottom + 4, left: rect.left })
                setFilterDropdownOpen(!filterDropdownOpen)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                taskFilter !== 'all'
                  ? 'text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
              style={taskFilter !== 'all' ? { backgroundColor: accent } : {}}
            >
              {currentFilterLabel}
              <ChevronDown size={13} />
            </button>
            {filterDropdownOpen && (
              <div
                className="fixed bg-white rounded-xl shadow-xl border border-gray-100 z-[9999] py-1 w-40"
                style={{ top: filterPos.top, left: filterPos.left }}
              >
                {TASK_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setTaskFilter(opt.value); setFilterDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      taskFilter === opt.value ? 'font-medium' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    style={taskFilter === opt.value ? { color: accent } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <DndContext
            sensors={taskFilter === 'all' ? sensors : []}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={allTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {pendingTasks.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {pendingTasks.map((task) => (
                    <DraggableFeyTask
                      key={task.id}
                      task={task}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onOpenNotes={setNotesTask}
                    />
                  ))}
                </div>
              )}

              {completedTasks.length > 0 && (
                <div className={pendingTasks.length > 0 ? 'border-t border-gray-100' : ''}>
                  <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">
                    Completed
                  </p>
                  <div className="divide-y divide-gray-50">
                    {completedTasks.map((task) => (
                      <DraggableFeyTask
                        key={task.id}
                        task={task}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onOpenNotes={setNotesTask}
                      />
                    ))}
                  </div>
                </div>
              )}
            </SortableContext>
          </DndContext>

          {pendingTasks.length === 0 && completedTasks.length === 0 && (
            <div className="flex flex-col items-center py-12 text-gray-300">
              <ListTodo size={28} strokeWidth={1.5} />
              <p className="text-sm mt-3 text-gray-400">
                {taskFilter !== 'all' ? `No tasks match "${currentFilterLabel}"` : 'No tasks'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-[240px] lg:flex-shrink-0 p-4 lg:p-5 lg:pl-2 overflow-y-auto overflow-x-hidden">
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-4">Overview</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={15} className="text-green-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 leading-none">
                  {allTasks.filter((t) => t.done).length}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Clock size={15} className="text-amber-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 leading-none">
                  {allTasks.filter((t) => !t.done).length}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Pending</p>
              </div>
            </div>
            {overdueTasks.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={15} className="text-red-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-red-500 leading-none">{overdueTasks.length}</p>
                  <p className="text-xs text-red-400 mt-0.5">Overdue</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-5" style={{ backgroundColor: color }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textColor, opacity: 0.6 }}>
            Completion
          </p>
          <p className="font-mono text-4xl font-bold leading-none mb-3" style={{ color: textColor }}>
            {completionPct}%
          </p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.35)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%`, backgroundColor: '#ffffff' }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: textColor, opacity: 0.5 }}>
            {allTasks.filter((t) => t.done).length} of {allTasks.length} done
          </p>
        </div>
      </div>

      {filterDropdownOpen && (
        <div className="fixed inset-0 z-[9998]" onClick={() => setFilterDropdownOpen(false)} />
      )}

      {notesTask && (
        <NotesPanel
          task={notesTask}
          accent={accent}
          todayStr={todayStr}
          onClose={() => setNotesTask(null)}
        />
      )}
    </div>
  )
}
