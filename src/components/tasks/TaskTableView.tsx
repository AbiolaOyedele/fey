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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-2xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            <th className="py-2.5 px-4 font-semibold">Task name</th>
            <th className="py-2.5 px-3 font-semibold">Assignee</th>
            <th className="py-2.5 px-3 font-semibold">Due date</th>
            <th className="py-2.5 px-3 font-semibold">Priority</th>
            <th className="py-2.5 px-3 font-semibold">Estimated</th>
            <th className="py-2.5 px-3 font-semibold">Logged</th>
            <th className="py-2.5 px-3 font-semibold">Brand</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {tasks.map((t) => (
            <tr key={t.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-2.5 px-4">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => onToggleDone(t.id)}
                    className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${t.done ? 'border-transparent text-white' : 'border-gray-300'}`}
                    style={t.done ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
                  >
                    {t.done && <Check size={11} strokeWidth={3} />}
                  </button>
                  <button onClick={() => onOpen(t)} className={`text-left ${t.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.title}</button>
                </div>
              </td>
              <td className="py-2.5 px-3"><AssigneeAvatars assignees={t.assignees} size={20} /></td>
              <td className="py-2.5 px-3"><DueChip due={t.due_date} done={t.done} /></td>
              <td className="py-2.5 px-3"><PriorityPill priority={t.priority} /></td>
              <td className="py-2.5 px-3 text-gray-500">{formatMinutes(t.estimated_minutes)}</td>
              <td className="py-2.5 px-3 text-gray-500">{t.logged_minutes ? formatMinutes(t.logged_minutes) : '—'}</td>
              <td className="py-2.5 px-3 text-gray-500 max-w-[160px] truncate">{t.project_title ?? t.contact_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
