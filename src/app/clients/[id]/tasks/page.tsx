'use client'

import { use, useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, Circle, ListTodo, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskRow {
  id:         string
  title:      string
  done:       boolean
  paid:       boolean
  amount:     number
  created_at: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TasksTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()

  const [tasks,    setTasks]    = useState<TaskRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding,   setAdding]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return
    void (async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, done, paid, amount, created_at')
        .eq('user_id', user.id)
        .eq('client_id', id)
        .order('created_at', { ascending: true })
      setTasks((data as TaskRow[]) ?? [])
      setLoading(false)
    })()
  }, [user?.id, id])

  // ── Add task ───────────────────────────────────────────────────────────────

  const handleAdd = useCallback(async () => {
    const title = newTitle.trim()
    if (!title || !user?.id || adding) return
    setAdding(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tasks')
      .insert({
        user_id:   user.id,
        client_id: id,
        title,
        done:      false,
        paid:      false,
        amount:    0,
      })
      .select('id, title, done, paid, amount, created_at')
      .single()
    if (err) {
      setError(err.message)
    } else if (data) {
      setTasks((prev) => [...prev, data as TaskRow])
      setNewTitle('')
      inputRef.current?.focus()
    }
    setAdding(false)
  }, [newTitle, user?.id, id, adding])

  // ── Toggle done ───────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (task: TaskRow) => {
    const next = !task.done
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: next } : t))
    await supabase.from('tasks').update({ done: next }).eq('id', task.id).eq('user_id', user?.id ?? '')
  }, [user?.id])

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', user?.id ?? '')
  }, [user?.id])

  const done    = tasks.filter((t) => t.done).length
  const pending = tasks.length - done

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-400">
            {loading ? '…' : `${pending} pending · ${done} completed`}
          </p>
        </div>
      </div>

      {/* Stats */}
      {!loading && tasks.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'Pending',   value: pending, color: 'text-gray-900' },
            { label: 'Completed', value: done,    color: 'text-emerald-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add task input */}
      <div className="mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-gray-400 transition-colors shadow-sm">
          <Plus size={15} className="text-gray-300 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
            placeholder="Add a task… press Enter"
            className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder-gray-300"
          />
          {newTitle.trim() && (
            <button
              onClick={() => void handleAdd()}
              disabled={adding}
              className="flex-shrink-0 px-3 py-1 rounded-xl text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              {adding ? '…' : 'Add'}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-500 mt-1.5 px-1">{error}</p>}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ListTodo size={32} className="text-gray-200 mb-3" />
          <p className="text-[15px] font-medium text-gray-500 mb-1">No tasks yet</p>
          <p className="text-[13px] text-gray-400">Type above and press Enter to add your first task.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors group"
            >
              <button
                onClick={() => void handleToggle(task)}
                className="flex-shrink-0 text-gray-300 hover:text-emerald-400 transition-colors"
              >
                {task.done
                  ? <CheckCircle2 size={18} className="text-emerald-400" />
                  : <Circle       size={18} />
                }
              </button>

              <span className={`flex-1 text-[14px] ${task.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {task.title}
              </span>

              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                task.done ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-100 text-gray-500'
              }`}>
                {task.done ? 'Done' : 'Open'}
              </span>

              <button
                onClick={() => void handleDelete(task.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                title="Delete task"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
