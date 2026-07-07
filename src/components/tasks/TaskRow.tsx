'use client'

import Link from 'next/link'
import { Check, Paperclip, CalendarDays } from 'lucide-react'
import type { Task } from '@/types/work-tasks'
import { AssigneeAvatars, DueChip, PriorityFlag, formatMinutes } from './TaskBits'
import { getFileType, isImageType, thumbUrl, type FileType } from '@/utils/cloudinary'

/** Up to 3 tiny image thumbnails + a count for the rest — quiet row-level hint
 *  that a task carries attachments. Clicking the row opens the drawer where the
 *  full grid lives. */
function FileThumbs({ task }: { task: Task }) {
  if (task.files.length === 0) return null
  const images = task.files.filter((f) => isImageType((f.file_type as FileType) ?? getFileType(f.file_name))).slice(0, 3)
  const rest = task.files.length - images.length
  return (
    <span className="hidden sm:flex items-center gap-1">
      {images.map((f) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={f.id} src={thumbUrl(f.file_url, 64)} alt="" className="w-[18px] h-[18px] rounded object-cover border border-black/5" loading="lazy" />
      ))}
      {rest > 0 && (
        <span className="flex items-center gap-0.5 text-2xs text-gray-400">
          <Paperclip size={11} />{rest}
        </span>
      )}
    </span>
  )
}

interface TaskRowProps {
  task: Task
  onToggleDone: (id: string) => void
  onOpen: (task: Task) => void
}

/** A single task row for the list views. */
export default function TaskRow({ task, onToggleDone, onOpen }: TaskRowProps) {
  return (
    <div className="group flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-gray-50 transition-colors">
      <button
        onClick={() => onToggleDone(task.id)}
        aria-label={task.done ? 'Mark not done' : 'Mark done'}
        className={`relative w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors after:absolute after:-inset-[6px] after:content-[''] ${
          task.done ? 'border-transparent text-white' : 'border-gray-300 hover:border-gray-400'
        }`}
        style={task.done ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
      >
        {task.done && <Check size={12} strokeWidth={3} />}
      </button>

      <button onClick={() => onOpen(task)} className="flex-1 min-w-0 text-left">
        <p className={`text-sm truncate ${task.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </p>
        {task.subtasks.length > 0 && (
          <p className="text-2xs text-gray-400 mt-0.5">
            {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length} subtasks
          </p>
        )}
      </button>

      <div className="flex items-center gap-3 flex-shrink-0">
        {task.social_post && (
          <Link
            href={`/playground/social?date=${task.social_post.scheduled_date}&post=${task.social_post.id}`}
            onClick={(e) => e.stopPropagation()}
            title="Open this post on the content calendar"
            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <CalendarDays size={14} />
          </Link>
        )}
        <FileThumbs task={task} />
        <AssigneeAvatars assignees={task.assignees} />
        <div className="hidden sm:block w-20 text-right"><DueChip due={task.due_date} done={task.done} /></div>
        {task.estimated_minutes != null && (
          <span className="hidden md:inline text-2xs text-gray-400 w-12 text-right">{formatMinutes(task.estimated_minutes)}</span>
        )}
        <PriorityFlag priority={task.priority} />
      </div>
    </div>
  )
}
