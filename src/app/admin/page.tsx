'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  Users, Building2, MessageSquare, FileText, FileSignature,
  ClipboardList, HardDrive, Receipt, Loader2, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/utils/formatDate'
import type { AdminMetrics } from '@/services/admin.service'
import type { Feedback, FeedbackStatus } from '@/types/feedback'

type LoadState = 'loading' | 'ready' | 'forbidden' | 'unauth' | 'error'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const STATUS_NEXT: Record<FeedbackStatus, FeedbackStatus> = {
  new: 'triaged',
  triaged: 'done',
  done: 'new',
}

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: 'bg-pink-50 text-pink-600',
  triaged: 'bg-amber-50 text-amber-600',
  done: 'bg-green-50 text-green-600',
}

export default function AdminPage() {
  const [state, setState] = useState<LoadState>('loading')
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])

  const load = useCallback(async () => {
    setState('loading')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setState('unauth'); return }
    try {
      const res = await fetch('/api/v1/admin/metrics', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.status === 403) { setState('forbidden'); return }
      if (!res.ok) { setState('error'); return }
      const data = await res.json() as { metrics: AdminMetrics; feedback: Feedback[] }
      setMetrics(data.metrics)
      setFeedback(data.feedback)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const cycleStatus = useCallback(async (item: Feedback) => {
    const next = STATUS_NEXT[item.status]
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setFeedback((prev) => prev.map((f) => f.id === item.id ? { ...f, status: next } : f))
    await fetch(`/api/v1/admin/feedback/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ status: next }),
    }).catch(() => { /* optimistic — refetch on next load */ })
  }, [])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-appbg">
        <Loader2 className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (state === 'unauth' || state === 'forbidden') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-appbg text-center px-4">
        <p className="text-lg font-semibold text-gray-900 mb-1">
          {state === 'unauth' ? 'Please sign in' : 'No access'}
        </p>
        <p className="text-sm text-gray-500">
          {state === 'unauth'
            ? 'You need to be signed in to view the admin board.'
            : 'This page is restricted to administrators.'}
        </p>
      </div>
    )
  }

  if (state === 'error' || !metrics) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-appbg text-center px-4">
        <p className="text-sm text-gray-500 mb-3">Couldn’t load the metrics.</p>
        <button onClick={() => void load()} className="text-sm font-semibold text-pink-600">Try again</button>
      </div>
    )
  }

  const cards: Array<{ label: string; value: string | number; sub?: string; icon: typeof Users }> = [
    { label: 'Workspaces', value: metrics.workspaces, sub: `${metrics.members} members`, icon: Building2 },
    { label: 'Clients', value: metrics.clients.total, sub: `${metrics.clients.archived} archived`, icon: Users },
    { label: 'Portal users', value: metrics.portalUsers.total, sub: `${metrics.portalUsers.active7d} active 7d`, icon: Users },
    { label: 'Messages', value: metrics.messages.total, sub: `${metrics.messages.fromClients} from clients`, icon: MessageSquare },
    { label: 'Files', value: metrics.files.total, sub: formatBytes(metrics.files.totalBytes), icon: HardDrive },
    { label: 'Invoices', value: metrics.invoices.total, sub: `${metrics.invoices.paid} paid`, icon: Receipt },
    { label: 'Contracts', value: metrics.contracts.total, sub: `${metrics.contracts.signed} signed`, icon: FileSignature },
    { label: 'Forms', value: metrics.forms.total, sub: `${metrics.forms.submitted} submitted`, icon: ClipboardList },
  ]

  return (
    <div className="min-h-screen bg-appbg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
            <p className="text-sm text-gray-500">Fey product metrics &amp; feedback</p>
          </div>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-100"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">{c.label}</span>
                <c.icon size={16} className="text-gray-300" />
              </div>
              <p className="text-2xl font-mono font-semibold text-gray-900">{c.value}</p>
              {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* Signups chart */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">New workspaces · last 12 weeks</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.signupsByWeek}>
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: string) => v.slice(5)} />
                <Tooltip cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="count" fill="var(--accent, #ED64A6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feedback inbox */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Feedback</h2>
            <span className="text-xs text-gray-400">{metrics.feedback.new} new · {metrics.feedback.total} total</span>
          </div>
          {feedback.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText size={24} className="text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No feedback yet</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {feedback.map((f) => (
                <div key={f.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700 capitalize">{f.type}</span>
                      <span className="text-2xs text-gray-400">{f.source}</span>
                      <span className="text-2xs text-gray-300">· {formatDateTime(f.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{f.message}</p>
                    {f.page_url && <p className="text-2xs text-gray-400 mt-1">{f.page_url}</p>}
                  </div>
                  <button
                    onClick={() => void cycleStatus(f)}
                    title="Click to change status"
                    className={`flex-shrink-0 text-2xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[f.status]}`}
                  >
                    {f.status}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
