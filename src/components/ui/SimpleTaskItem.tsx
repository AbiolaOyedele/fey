'use client'

import { useState } from 'react'
import { Trash2, Check, Calendar, GripVertical, Info } from 'lucide-react'
import type { DraggableSyntheticListeners } from '@dnd-kit/core'
import type { StandaloneTask } from '@/types'

function formatDeadline(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const todayStr = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

interface SimpleTaskItemProps {
  task: StandaloneTask
  onUpdate: (task: StandaloneTask) => void
  onDelete: (id: string) => void
  onInfo?: (task: StandaloneTask) => void
  dragListeners?: DraggableSyntheticListeners
  dragAttributes?: Record<string, unknown>
}

export default function SimpleTaskItem({ task, onUpdate, onDelete, onInfo, dragListeners, dragAttributes }: SimpleTaskItemProps) {
  const [editing,  setEditing]  = useState(false)
  const [title,    setTitle]    = useState(task.title)
  const [deleting, setDeleting] = useState(false)
  const [bouncing, setBouncing] = useState(false)

  const today     = todayStr()
  const isOverdue = Boolean(task.deadline && !task.done && task.deadline < today)
  const isToday   = Boolean(task.deadline && task.deadline === today)

  const handleDone = () => {
    setBouncing(true)
    setTimeout(() => setBouncing(false), 200)
    onUpdate({ ...task, done: !task.done })
  }

  const handleTitleBlur = () => {
    setEditing(false)
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) {
      setTitle(trimmed)
      onUpdate({ ...task, title: trimmed })
    } else {
      setTitle(task.title)
    }
  }

  const handleDeadlineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...task, deadline: e.target.value || null })
  }

  const handleDelete = () => {
    setDeleting(true)
    setTimeout(() => onDelete(task.id), 200)
  }

  return (
    <div
      className={`group flex items-center gap-2.5 py-2.5 px-3 rounded-xl transition-all duration-150 hover:bg-gray-50 relative ${
        deleting ? 'animate-fadeOut opacity-0' : ''
      }`}
    >
      {isOverdue && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-red-400" />
      )}

      <span
        onClick={handleDone}
        role="checkbox"
        aria-checked={task.done}
        className={`rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 cursor-pointer ${
          bouncing ? 'animate-scaleBounce' : ''
        } ${task.done ? 'text-white' : 'border-gray-200'}`}
        style={{
          width: 18, height: 18,
          ...(task.done ? { backgroundColor: 'var(--accent, #ED64A6)', borderColor: 'var(--accent, #ED64A6)' } : {}),
        }}
        onMouseEnter={(e) => { if (!task.done) (e.currentTarget as HTMLSpanElement).style.borderColor = 'var(--accent, #ED64A6)' }}
        onMouseLeave={(e) => { if (!task.done) (e.currentTarget as HTMLSpanElement).style.borderColor = '' }}
      >
        {task.done && <Check size={10} strokeWidth={3} />}
      </span>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
            className="w-full bg-transparent outline-none text-sm border-b border-gray-200 pb-px"
          />
        ) : (
          <p
            onClick={() => setEditing(true)}
            className={`text-sm cursor-text truncate leading-snug ${
              task.done ? 'line-through text-gray-400' : 'text-gray-700'
            }`}
          >
            {task.title}
          </p>
        )}
      </div>

      {task.deadline && (
        <span
          className={`flex-shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-md leading-none ${
            isOverdue ? 'bg-red-50 text-red-500' : isToday ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {formatDeadline(task.deadline)}
        </span>
      )}

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {onInfo && (
          <button
            onClick={() => onInfo(task)}
            className="w-7 h-7 rounded-lg flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-all"
            title="View notes"
          >
            <Info size={13} />
          </button>
        )}

        <div
          className={`relative w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
            isOverdue
              ? 'text-red-400 hover:bg-red-50'
              : task.deadline
              ? 'text-amber-400 hover:bg-amber-50'
              : 'sm:opacity-0 sm:group-hover:opacity-100 text-gray-300 hover:bg-gray-100 hover:text-gray-500'
          }`}
          title={task.deadline ? `Due: ${formatDeadline(task.deadline)}` : 'Set deadline'}
        >
          <Calendar size={13} className="pointer-events-none" />
          <input
            type="date"
            value={task.deadline || ''}
            onChange={handleDeadlineChange}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            tabIndex={-1}
          />
        </div>

        <button
          onClick={handleDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all"
        >
          <Trash2 size={13} />
        </button>

        {dragListeners && (
          <button
            {...(dragListeners as Record<string, unknown>)}
            {...(dragAttributes as Record<string, unknown>)}
            className="w-7 h-7 rounded-lg flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing touch-none text-gray-300 transition-opacity"
            tabIndex={-1}
          >
            <GripVertical size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
