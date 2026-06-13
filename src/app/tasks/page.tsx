'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, GripVertical, ListTodo, FolderOpen, Trash2 } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
  rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SimpleTaskItem from '@/components/ui/SimpleTaskItem'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useTaskGroupData } from '@/hooks/useTaskGroupData'
import { PALETTE } from '@/data/defaultClients'
import { ICON_NAMES, ICON_MAP, TaskGroupIcon } from '@/lib/taskGroupIcons'
import { getContrastColor } from '@/utils/colorContrast'
import type { TaskGroup, StandaloneTask } from '@/types'

const normalizeHex = (val: string) => val.trim().startsWith('#') ? val.trim() : `#${val.trim()}`
const isValidHex   = (val: string) => /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(val))

// ── Draggable standalone task ──────────────────────────────────────────────────

interface DraggableTaskProps {
  task: StandaloneTask
  onUpdate: (task: StandaloneTask) => void
  onDelete: (taskId: string) => void
}

function DraggableTask({ task, onUpdate, onDelete }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      <SimpleTaskItem
        task={task}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragListeners={listeners}
        dragAttributes={attributes as unknown as Record<string, unknown>}
      />
    </div>
  )
}

// ── Sortable group card ────────────────────────────────────────────────────────

interface SortableGroupCardProps {
  group: TaskGroup
  isDraggingRef: React.MutableRefObject<boolean>
  onDelete: (group: TaskGroup) => void
}

function SortableGroupCard({ group, isDraggingRef, onDelete }: SortableGroupCardProps) {
  const router    = useRouter()
  const textColor = getContrastColor(group.color)
  const total     = group.tasks.length
  const done      = group.tasks.filter((t) => t.done).length
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: group.color,
  }

  const handleClick = () => {
    if (isDraggingRef.current) return
    router.push(`/tasks/${group.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-2xl p-4 sm:p-5 cursor-pointer transition-shadow duration-150 hover:shadow-md relative overflow-hidden"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/60"
          style={{ color: textColor }}
        >
          {done}/{total} tasks
        </span>
      </div>

      <h3 className="font-display text-xl font-bold mb-1 leading-tight line-clamp-1" style={{ color: textColor }}>
        {group.name}
      </h3>

      <p className="text-sm mb-4" style={{ color: textColor, opacity: 0.7 }}>
        {done} completed, {total - done} pending
      </p>

      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.4)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: '#ffffff' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/50 hover:bg-white/80 transition-all cursor-grab active:cursor-grabbing touch-none"
            style={{ color: textColor }}
          >
            <GripVertical size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(group) }}
            className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/50 hover:bg-white/80 transition-all"
            style={{ color: textColor }}
          >
            <Trash2 size={12} />
          </button>
          <div
            className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center flex-shrink-0"
            style={{ color: textColor }}
          >
            {group.icon
              ? <TaskGroupIcon name={group.icon} size={15} />
              : <span className="text-sm font-bold">{group.name.charAt(0).toUpperCase()}</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth()
  const {
    groups, standaloneTasks,
    addGroup, removeGroup, reorderGroups,
    addStandaloneTask, updateStandaloneTask, removeStandaloneTask, reorderStandaloneTasks,
  } = useTaskGroupData(user?.id)
  const { trashGroup, trashStandaloneTask, showToast } = useSettings()

  const [newTaskInput, setNewTaskInput] = useState('')
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupName,      setGroupName]      = useState('')
  const [groupColor,     setGroupColor]     = useState('')
  const [groupIcon,      setGroupIcon]      = useState('')
  const [groupCustomHex, setGroupCustomHex] = useState('')

  const isDraggingRef = useRef(false)
  const taskSensors   = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const groupSensors  = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // ── task handlers ────────────────────────────────────────────────────────────

  const handleAddTask = async () => {
    const trimmed = newTaskInput.trim()
    if (!trimmed) return
    await addStandaloneTask(trimmed)
    setNewTaskInput('')
  }

  const handleUpdateTask = (updated: StandaloneTask) =>
    void updateStandaloneTask(updated.id, { title: updated.title, done: updated.done, deadline: updated.deadline })

  const handleDeleteTask = async (taskId: string) => {
    const task = standaloneTasks.find((t) => t.id === taskId)
    if (!task) return
    removeStandaloneTask(taskId)
    const item = await trashStandaloneTask(task as unknown as { id: string; title: string; [key: string]: unknown })
    if (item) showToast(`"${task.title}" moved to trash`)
  }

  const handleTaskDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = standaloneTasks.findIndex((t) => t.id === active.id)
    const newIndex  = standaloneTasks.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    void reorderStandaloneTasks(arrayMove(standaloneTasks, oldIndex, newIndex).map((t) => t.id))
  }, [standaloneTasks, reorderStandaloneTasks])

  // ── group handlers ───────────────────────────────────────────────────────────

  const handleGroupDragStart = useCallback((_event: DragStartEvent) => {
    isDraggingRef.current = true
  }, [])

  const handleGroupDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setTimeout(() => { isDraggingRef.current = false }, 500)
    if (!over || active.id === over.id) return
    const oldIndex = groups.findIndex((g) => g.id === active.id)
    const newIndex  = groups.findIndex((g) => g.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    void reorderGroups(arrayMove(groups, oldIndex, newIndex).map((g) => g.id))
  }, [groups, reorderGroups])

  const handleDeleteGroup = async (group: TaskGroup) => {
    removeGroup(group.id)
    const item = await trashGroup(group as unknown as { id: string; name: string; [key: string]: unknown })
    if (item) showToast(`"${group.name}" moved to trash`)
  }

  // ── group modal ──────────────────────────────────────────────────────────────

  const openGroupModal = () => {
    const usedColors = new Set(groups.map((g) => g.color))
    const available  = PALETTE.filter((c) => !usedColors.has(c))
    setGroupColor(available[0] ?? PALETTE[0])
    setGroupName('')
    setGroupIcon('')
    setGroupCustomHex('')
    setShowGroupModal(true)
  }

  const handleAddGroup = async () => {
    if (!groupName.trim()) return
    await addGroup(groupName.trim(), groupColor, groupIcon)
    setShowGroupModal(false)
  }

  const usedColors    = new Set(groups.map((g) => g.color))
  const paletteToShow = PALETTE.filter((c) => !usedColors.has(c)).length > 0
    ? PALETTE.filter((c) => !usedColors.has(c))
    : PALETTE

  const pendingCount = standaloneTasks.filter((t) => !t.done).length
  const doneCount    = standaloneTasks.filter((t) => t.done).length

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:h-screen page-enter lg:overflow-hidden overflow-x-hidden">

        {/* ── Left: standalone tasks ── */}
        <div className="lg:overflow-y-auto w-full lg:w-[60%] lg:flex-shrink-0">
          <div className="p-4 lg:p-8">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold text-gray-900">
                Tasks
              </h1>
              {standaloneTasks.length > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {pendingCount} pending · {doneCount} done
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 mb-5">
              <input
                type="text"
                placeholder="Add a task and press Enter…"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddTask() }}
                className="flex-1 px-4 py-2.5 bg-white rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-300 transition-all shadow-sm placeholder:text-gray-300"
              />
              <button
                onClick={() => void handleAddTask()}
                disabled={!newTaskInput.trim()}
                className="flex items-center gap-1.5 px-5 py-2.5 text-white rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-all flex-shrink-0"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                <Plus size={15} />
                Add
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {standaloneTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <ListTodo size={28} strokeWidth={1.5} className="text-gray-200 mb-3" />
                  <p className="text-sm2 font-medium text-gray-500">No tasks yet</p>
                  <p className="text-xs2 text-gray-400 mt-0.5">Type above to add your first task</p>
                </div>
              ) : (
                <DndContext
                  sensors={taskSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleTaskDragEnd}
                >
                  <SortableContext items={standaloneTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="divide-y divide-gray-50">
                      {standaloneTasks.map((task) => (
                        <DraggableTask
                          key={task.id}
                          task={task}
                          onUpdate={handleUpdateTask}
                          onDelete={(id) => void handleDeleteTask(id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: task groups ── */}
        <div className="lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-gray-100 w-full lg:w-[40%] lg:flex-shrink-0 rounded-2xl lg:rounded-none mx-0">
          <div className="p-4 lg:p-6 pb-10">
            <div className="flex items-center justify-between mb-6 pt-2">
              <div>
                <h2 className="font-display text-2xl font-bold text-gray-900">Grouped Tasks</h2>
                {groups.length > 0 && (
                  <p className="text-sm text-gray-400 mt-0.5">
                    {groups.length} {groups.length === 1 ? 'group' : 'groups'}
                  </p>
                )}
              </div>
              <button
                onClick={openGroupModal}
                className="flex items-center gap-1.5 px-3.5 py-2 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                <Plus size={14} />
                New Group
              </button>
            </div>

            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <FolderOpen size={28} strokeWidth={1.5} className="text-gray-200 mb-3" />
                <p className="text-sm2 font-medium text-gray-500">No groups yet</p>
                <p className="text-xs2 text-gray-400 mt-0.5">Create a group to organise related tasks</p>
              </div>
            ) : (
              <DndContext
                sensors={groupSensors}
                modifiers={[restrictToParentElement]}
                collisionDetection={closestCenter}
                onDragStart={handleGroupDragStart}
                onDragEnd={handleGroupDragEnd}
              >
                <SortableContext items={groups.map((g) => g.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {groups.map((group) => (
                      <SortableGroupCard
                        key={group.id}
                        group={group}
                        isDraggingRef={isDraggingRef}
                        onDelete={(g) => void handleDeleteGroup(g)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Group Modal ── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-semibold">New Group</h2>
              <button
                onClick={() => setShowGroupModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <input
              autoFocus
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAddGroup() }}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-300 mb-5"
            />

            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Color</p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {paletteToShow.map((color) => (
                  <button
                    key={color}
                    onClick={() => { setGroupColor(color); setGroupCustomHex('') }}
                    className="w-6 h-6 rounded-full transition-all duration-150 hover:scale-110"
                    style={{
                      backgroundColor: color,
                      outline: groupColor === color ? '2px solid #9CA3AF' : '2px solid transparent',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {groupCustomHex && isValidHex(groupCustomHex) && (
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 border border-gray-200"
                    style={{ backgroundColor: normalizeHex(groupCustomHex) }}
                  />
                )}
                <input
                  type="text"
                  placeholder="#hex"
                  value={groupCustomHex}
                  onChange={(e) => {
                    setGroupCustomHex(e.target.value)
                    if (isValidHex(e.target.value)) setGroupColor(normalizeHex(e.target.value))
                  }}
                  maxLength={7}
                  className="w-28 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-sm font-mono outline-none focus:border-gray-400 transition-all"
                />
                {groupCustomHex && !isValidHex(groupCustomHex) && (
                  <span className="text-xs text-red-400">Invalid</span>
                )}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                Icon <span className="normal-case font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-8 gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                {ICON_NAMES.map((name) => {
                  const IconComp = ICON_MAP[name]
                  return (
                    <button
                      key={name}
                      onClick={() => setGroupIcon(groupIcon === name ? '' : name)}
                      title={name}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                        groupIcon === name ? 'text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-white'
                      }`}
                      style={groupIcon === name ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
                    >
                      <IconComp size={15} />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAddGroup()}
                disabled={!groupName.trim()}
                className="px-5 py-2 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
