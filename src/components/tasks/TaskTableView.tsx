'use client'

import { Check } from 'lucide-react'
import type { Task } from '@/types/work-tasks'
import { AssigneeAvatars, DueChip, PriorityPill, formatMinutes } from './TaskBits'

interface TaskTableViewProps {
  tasks: Task[]
  onToggleDone: (id: string) => void
  onOpen: (task: Task) => void
}

/** Spreadsheet view: Task / Assignee / Due / Priority / Est / Logged / Project. */
export default function TaskTableView({ tasks, onToggleDone, onOpen }: TaskTableViewProps) {
  if (tasks.length === 0) {
    return <p className="text-sm text-gray-400 py-16 text-center">No tasks to show.</p>
  }
  return (
    // Full-bleed on mobile (-mx-4 cancels the page's px-4) so the table uses the
    // whole screen width and the columns need only a single swipe to reveal.
    // The card border/rounding is restored from the lg breakpoint up.
    <div className="-mx-4 lg:mx-0 bg-white border-y border-gray-100 lg:border lg:rounded-2xl lg:shadow-sm overflow-x-auto overscroll-x-contain">
      {/* min-w keeps every column comfortably readable; the container scrolls
          horizontally as one unit instead of cramming cells on small screens. */}
      <table className="w-full min-w-[660px] text-sm">
        <thead>
          <tr className="text-left text-2xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Task name</th>
            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Assignee</th>
            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Due date</th>
            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Priority</th>
            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Estimated</th>
            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Logged</th>
            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Brand</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {tasks.map((t) => (
            <tr key={t.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-2.5 px-4">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => onToggleDone(t.id)}
                    className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${t.done ? 'border-transparent text-white' : 'border-gray-300'}`}
                    style={t.done ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
                  >
                    {t.done && <Check size={11} strokeWidth={3} />}
                  </button>
                  <button onClick={() => onOpen(t)} className={`text-left whitespace-nowrap ${t.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.title}</button>
                </div>
              </td>
              <td className="py-2.5 px-3"><AssigneeAvatars assignees={t.assignees} size={20} /></td>
              <td className="py-2.5 px-3 whitespace-nowrap"><DueChip due={t.due_date} done={t.done} /></td>
              <td className="py-2.5 px-3 whitespace-nowrap"><PriorityPill priority={t.priority} /></td>
              <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{formatMinutes(t.estimated_minutes)}</td>
              <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{t.logged_minutes ? formatMinutes(t.logged_minutes) : '—'}</td>
              <td className="py-2.5 px-3 text-gray-500 max-w-[160px] truncate">{t.project_title ?? t.contact_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
