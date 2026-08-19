'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Send } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import type { TaskComment } from '@/types/work-tasks'

interface PortalTaskCommentsProps {
  taskId: string
  subdomain: string
  /** The signed-in portal user, so their own comments read as "You". */
  portalUserId: string
  /** Viewers read the thread but can't add to it. */
  canWrite: boolean
  accent: string
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return sameDay ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`
}

/**
 * The comment thread on a task, as the client sees it.
 *
 * Deliberately not the app's `TaskComments`: that one reads the Supabase session
 * and the workspace roster directly for @mentions, and a portal user has neither
 * — they aren't an auth user. The thread underneath is the same rows, so a
 * client's question and the team's reply sit in one conversation rather than two.
 *
 * Team members show as the agency rather than by name. Which individual is
 * handling the work is the agency's business, and the client's counterpart is
 * the agency itself.
 */
export default function PortalTaskComments({
  taskId, subdomain, portalUserId, canWrite, accent,
}: PortalTaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [draft, setDraft]       = useState('')
  const [sending, setSending]   = useState(false)

  const headers = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [subdomain])

  const load = useCallback(async () => {
    const h = headers()
    if (!h) { setLoading(false); return }
    try {
      const res = await fetch(`/api/v1/portal/tasks/${taskId}/comments`, { headers: h })
      if (!res.ok) throw new Error('load failed')
      const d = await res.json() as { comments: TaskComment[] }
      setComments(d.comments ?? [])
      setError(null)
    } catch {
      setError('Couldn’t load the comments. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [taskId, headers])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const send = useCallback(async () => {
    const body = draft.trim()
    if (!body || sending) return
    const h = headers()
    if (!h) return
    setSending(true)
    try {
      const res = await fetch(`/api/v1/portal/tasks/${taskId}/comments`, {
        method: 'POST', headers: h, body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(d?.error?.message ?? 'That comment couldn’t be sent.')
      }
      const d = await res.json() as { comment: TaskComment }
      setComments((cur) => [...cur, d.comment])
      setDraft('')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That comment couldn’t be sent.')
    } finally {
      setSending(false)
    }
  }, [draft, sending, headers, taskId])

  return (
    <div>
      <p className="text-xs2 font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        Comments {comments.length > 0 && <span className="text-gray-300">· {comments.length}</span>}
      </p>

      <div className="space-y-3 mb-3">
        {loading ? (
          <p className="text-sm text-gray-400">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-400">
            {canWrite ? 'No comments yet. Ask a question or leave a note for the team.' : 'No comments yet.'}
          </p>
        ) : (
          comments.map((c) => {
            const mine = c.portal_author_id === portalUserId
            const fromTeam = c.portal_author_id === null
            const name = mine ? 'You' : fromTeam ? 'The team' : (c.portal_author_name ?? 'Your colleague')
            return (
              <div key={c.id} className="animate-slideUp">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs2 font-semibold text-gray-700">{name}</span>
                  <span className="text-xs2 text-gray-300">
                    {timeLabel(c.created_at)}{c.edited_at && ' · edited'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            )
          })
        )}
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {canWrite && (
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the same shortcut as
              // every other composer in the product.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
            }}
            rows={2}
            placeholder="Write a comment…"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 resize-none"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !draft.trim()}
            aria-label="Send comment"
            className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center text-white disabled:opacity-40"
            style={{ backgroundColor: accent }}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      )}
    </div>
  )
}
