'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Check, Paperclip, CalendarDays, ChevronDown } from 'lucide-react'
import type { Task } from '@/types/work-tasks'
import { AssigneeAvatars, DueChip, PriorityFlag, formatMinutes } from './TaskBits'
import { getFileType, isImageType, thumbUrl, type FileType } from '@/utils/cloudinary'

const expandVariants: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: { duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] },
  },
}

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

/** A single task row for the list views. Expands inline to show description
 *  and subtasks without leaving the list; the title still opens the full drawer. */
export default function TaskRow({ task, onToggleDone, onOpen }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false)
  const hasExpandableContent = Boolean(task.description) || task.subtasks.length > 0

  return (
    <div className="group">
      <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-gray-50 transition-colors">
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
          <button
            onClick={() => setExpanded((v) => !v)}
            disabled={!hasExpandableContent}
            aria-label={expanded ? 'Collapse task' : 'Expand task'}
            aria-expanded={expanded}
            className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
              hasExpandableContent ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100' : 'text-gray-200 cursor-default'
            }`}
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex"
            >
              <ChevronDown size={14} />
            </motion.span>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && hasExpandableContent && (
          <motion.div
            variants={expandVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="overflow-hidden"
          >
            <div className="pl-11 pr-4 pb-3 -mt-1 space-y-2">
              {task.description && (
                <p className="text-xs2 text-gray-500 leading-relaxed">{task.description}</p>
              )}
              {task.subtasks.length > 0 && (
                <ul className="space-y-1">
                  {task.subtasks.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-xs2">
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                          s.done ? 'border-transparent text-white' : 'border-gray-300'
                        }`}
                        style={s.done ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
                      >
                        {s.done && <Check size={9} strokeWidth={3} />}
                      </span>
                      <span className={s.done ? 'line-through text-gray-400' : 'text-gray-600'}>{s.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
