'use client'

import { useMemo } from 'react'
import { ListTodo } from 'lucide-react'
import type { Task } from '@/types/work-tasks'
import TaskRow from './TaskRow'

interface TaskListViewProps {
  tasks: Task[]
  grouped: boolean
  onToggleDone: (id: string) => void
  onOpen: (task: Task) => void
}

interface Group { key: string; label: string; sub: string | null; tasks: Task[] }

/** Grouped list. When `grouped`, splits by project/client with a Personal group on top. */
export default function TaskListView({ tasks, grouped, onToggleDone, onOpen }: TaskListViewProps) {
  const groups = useMemo<Group[]>(() => {
    if (!grouped) return [{ key: 'all', label: '', sub: null, tasks }]
    const map = new Map<string, Group>()
    for (const t of tasks) {
      const key = t.project_id ?? t.contact_id ?? 'personal'
      const label = t.project_title ?? t.contact_name ?? 'Personal'
      const sub = t.project_title && t.contact_name ? t.contact_name : null
      if (!map.has(key)) map.set(key, { key, label, sub, tasks: [] })
      map.get(key)!.tasks.push(t)
    }
    const list = [...map.values()]
    // Personal first, then alphabetical.
    return list.sort((a, b) => (a.key === 'personal' ? -1 : b.key === 'personal' ? 1 : a.label.localeCompare(b.label)))
  }, [tasks, grouped])

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ListTodo size={30} strokeWidth={1.5} className="text-gray-200 mb-3" />
        <p className="text-sm2 font-medium text-gray-500">No tasks here yet</p>
        <p className="text-xs2 text-gray-400 mt-0.5">Add one with the button above</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.key}>
          {grouped && (
            <div className="flex items-baseline gap-2 px-1 mb-1">
              <h3 className="text-sm font-semibold text-gray-900">{g.label}</h3>
              {g.sub && <span className="text-xs2 text-gray-400">{g.sub}</span>}
              <span className="text-xs2 text-gray-300">{g.tasks.length}</span>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
            {g.tasks.map((t) => <TaskRow key={t.id} task={t} onToggleDone={onToggleDone} onOpen={onOpen} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
