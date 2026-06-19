'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { CheckSquare2, Check, Flag } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import type { PortalTask } from '@/types/crm'

const PRIORITY_COLOR: Record<PortalTask['priority'], string> = {
  high: '#EF4444', medium: '#F59E0B', low: '#22C55E',
}

function formatDue(due: string): string {
  const d = new Date(due + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function PortalTasksPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const [tasks,   setTasks]   = useState<PortalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  const load = useCallback(async () => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    if (!token) { setLoading(false); return }
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/v1/portal/tasks', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { setError(true); return }
      const d = await res.json() as { tasks: PortalTask[] }
      setTasks(d.tasks)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => { void load() }, [load])

  const doneCount = tasks.filter((t) => t.done).length

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        {!loading && !error && tasks.length > 0 && (
          <p className="text-sm text-gray-400 mt-0.5">{doneCount} of {tasks.length} complete</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare2 size={32} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">Couldn&apos;t load your tasks</p>
          <button onClick={() => void load()} className="text-xs2 mt-2 underline text-gray-500 hover:text-gray-700">Try again</button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare2 size={32} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">No tasks yet</p>
          <p className="text-xs2 text-gray-400 mt-1">Tasks for your project will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${t.done ? 'bg-emerald-500' : 'border-2 border-gray-200'}`}>
                {t.done && <Check size={12} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${t.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</span>
                {t.project_title && <p className="text-2xs text-gray-400 truncate">{t.project_title}</p>}
              </div>
              {t.due_date && <span className="text-2xs text-gray-400 flex-shrink-0">{formatDue(t.due_date)}</span>}
              <Flag size={13} fill={PRIORITY_COLOR[t.priority]} style={{ color: PRIORITY_COLOR[t.priority] }} className="flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
