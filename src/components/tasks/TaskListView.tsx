'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListTodo, ChevronDown } from 'lucide-react'
import type { Task } from '@/types/work-tasks'
import TaskRow from './TaskRow'

interface TaskListViewProps {
  tasks: Task[]
  grouped: boolean
  onToggleDone: (id: string) => void
  onOpen: (task: Task) => void
}

interface Group { key: string; label: string; sub: string | null; tasks: Task[] }

/** Grouped list. When `grouped`, splits by project/client with a Personal group on top.
 *  Each group header collapses to hide its tasks. */
export default function TaskListView({ tasks, grouped, onToggleDone, onOpen }: TaskListViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleGroup = (key: string) => setCollapsed((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const groups = useMemo<Group[]>(() => {
    if (!grouped) return [{ key: 'all', label: '', sub: null, tasks }]
    const map = new Map<string, Group>()
    for (const t of tasks) {
      const unlinkedKey = t.visibility === 'team' ? 'team' : 'personal'
      const key = t.project_id ?? t.contact_id ?? unlinkedKey
      const label = t.project_title ?? t.contact_name ?? (t.visibility === 'team' ? 'Team' : 'Personal')
      const sub = t.project_title && t.contact_name ? t.contact_name : null
      if (!map.has(key)) map.set(key, { key, label, sub, tasks: [] })
      map.get(key)!.tasks.push(t)
    }
    const list = [...map.values()]
    // Personal, then Team, then clients alphabetically.
    const rank = (k: string) => (k === 'personal' ? 0 : k === 'team' ? 1 : 2)
    return list.sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label))
  }, [tasks, grouped])

  // Auto-collapse every group 2 minutes after the grouped view mounts, so a
  // list left open in a background tab settles down on its own. One-shot —
  // reads the latest group keys via a ref so it doesn't fire again as tasks load.
  const groupsRef = useRef(groups)
  useEffect(() => { groupsRef.current = groups }, [groups])
  useEffect(() => {
    if (!grouped) return
    const timer = setTimeout(() => {
      setCollapsed(new Set(groupsRef.current.map((g) => g.key)))
    }, 2 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [grouped])

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
      {groups.map((g) => {
        const isCollapsed = grouped && collapsed.has(g.key)
        return (
          <div key={g.key}>
            {grouped && (
              <button
                onClick={() => toggleGroup(g.key)}
                className="w-full flex items-center gap-2 px-1 mb-1 text-left group/header"
              >
                <motion.span
                  animate={{ rotate: isCollapsed ? -90 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 text-white shadow-sm group-hover/header:opacity-80 transition-opacity"
                  style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                >
                  <ChevronDown size={13} strokeWidth={2.5} />
                </motion.span>
                <h3 className="text-sm font-semibold text-gray-900">{g.label}</h3>
                {g.sub && <span className="text-xs2 text-gray-400">{g.sub}</span>}
                <span className="text-xs2 text-gray-300">{g.tasks.length}</span>
              </button>
            )}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={grouped ? { opacity: 0, height: 0 } : false}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
                  className="overflow-hidden"
                >
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
                    {g.tasks.map((t) => <TaskRow key={t.id} task={t} onToggleDone={onToggleDone} onOpen={onOpen} />)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
