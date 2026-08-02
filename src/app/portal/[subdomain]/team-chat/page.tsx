'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { Lock, Send, Trash2, Ban, Loader2, CornerUpLeft } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { usePortalSession } from '@/contexts/PortalSessionContext'
import { FadeIn } from '@/components/ui/motion'
import ReplyPreview from '@/components/chat/ReplyPreview'
import { canDeleteForEveryone, DELETED_MESSAGE_PLACEHOLDER } from '@/types/chat'
import type { PortalTeamMessage } from '@/services/portal-team-chat.service'

/**
 * The client's own private room.
 *
 * Private *from the agency*, not just from other clients — the table has no RLS
 * policy at all, so nothing but this portal can read it. That promise is stated
 * plainly at the top of the page, because a "private" channel people don't
 * trust is worse than no channel.
 */

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function PortalTeamChatPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const accent  = usePortalAccent(subdomain)
  const session = usePortalSession()
  const me      = session?.session.portalUser ?? null
  const canPost = me ? me.role !== 'viewer' : false

  const [messages, setMessages] = useState<PortalTeamMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [draft, setDraft]       = useState('')
  const [sending, setSending]   = useState(false)
  const [replyTo, setReplyTo]   = useState<PortalTeamMessage | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const headers = useCallback((): HeadersInit | null => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
  }, [subdomain])

  const load = useCallback(async () => {
    const h = headers()
    if (!h) { setLoading(false); return }
    try {
      const res = await fetch('/api/v1/portal/team-chat', { headers: h })
      if (!res.ok) throw new Error('load failed')
      const d = await res.json() as { messages: PortalTeamMessage[] }
      setMessages(d.messages)
    } catch {
      setError('Couldn’t load your conversation. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    // Loading a list IS synchronising with an external system; the rule fires
    // only because the fetch starts synchronously rather than from a callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    const body = draft.trim()
    const h = headers()
    if (!body || !h || sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/v1/portal/team-chat', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ body, reply_to_id: replyTo?.id ?? null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(d?.error?.message ?? 'That message couldn’t be sent.')
      }
      const d = await res.json() as { message: PortalTeamMessage }
      setMessages((prev) => [...prev, d.message])
      setDraft('')
      setReplyTo(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That message couldn’t be sent.')
    } finally {
      setSending(false)
    }
  }

  const remove = async (id: string) => {
    const h = headers()
    if (!h) return
    const previous = messages
    setMessages((prev) => prev.map((m) => (
      m.id === id ? { ...m, body: '', deleted_at: new Date().toISOString() } : m
    )))
    try {
      const res = await fetch(`/api/v1/portal/team-chat?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: h,
      })
      if (!res.ok) throw new Error('delete failed')
    } catch {
      setMessages(previous)
      setError('That message couldn’t be deleted.')
    }
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Lock size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Team chat</h1>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Just for your side. Nobody at the agency can see this conversation.
        </p>
      </FadeIn>

      {error && (
        <div className="rounded-xl p-3 text-xs mb-3" style={{ backgroundColor: '#FDECEC', color: '#E53E3E' }}>
          {error}
        </div>
      )}

      {/* Thread */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-12 rounded-2xl bg-gray-50 animate-pulse ${i % 2 ? 'w-1/2 ml-auto' : 'w-3/4'}`} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <Lock size={26} className="text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">Anything said here stays between your team.</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === me?.id
            const parent = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) ?? null : null
            // The client's own admin can remove anyone's message: there is no
            // agency moderator in this room by design, so without that a room
            // could be left with something nobody is able to take down.
            const canRemove = !m.deleted_at && canDeleteForEveryone(m, me?.id ?? null, me?.role === 'client_admin')
            return (
              <div key={m.id} className={`group/msg flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-700">
                      {isMine ? 'You' : m.sender_name}
                    </span>
                    <span className="text-2xs text-gray-400">
                      {timeLabel(m.created_at)}{m.edited_at && !m.deleted_at && ' · edited'}
                    </span>
                  </div>

                  {parent && !m.deleted_at && (
                    <div className="w-full max-w-[260px]">
                      <ReplyPreview
                        senderName={parent.sender_id === me?.id ? 'You' : parent.sender_name}
                        body={parent.body}
                        deleted={!!parent.deleted_at}
                        accent={accent}
                      />
                    </div>
                  )}

                  {m.deleted_at ? (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm italic text-gray-400 border border-dashed border-gray-200 rounded-2xl ${isMine ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                      <Ban size={12} />
                      {DELETED_MESSAGE_PLACEHOLDER}
                    </div>
                  ) : (
                    <div
                      className={`px-3 py-2 text-sm leading-relaxed break-words rounded-2xl ${isMine ? 'rounded-tr-sm text-white' : 'rounded-tl-sm text-gray-800'}`}
                      style={isMine ? { backgroundColor: accent } : { backgroundColor: '#F3F4F6' }}
                    >
                      {m.body}
                    </div>
                  )}

                  {!m.deleted_at && canPost && (
                    <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={() => setReplyTo(m)}
                        aria-label="Reply to this message"
                        className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-full"
                      >
                        <CornerUpLeft size={12} />
                      </button>
                      {canRemove && (
                        <button
                          onClick={() => void remove(m.id)}
                          aria-label="Delete this message for everyone"
                          className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 rounded-full"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {canPost ? (
        <div className="flex-shrink-0 pt-3">
          {replyTo && (
            <ReplyPreview
              senderName={replyTo.sender_id === me?.id ? 'You' : replyTo.sender_name}
              body={replyTo.body}
              deleted={!!replyTo.deleted_at}
              accent={accent}
              onCancel={() => setReplyTo(null)}
            />
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              rows={1}
              placeholder="Message your team…"
              aria-label="Message your team"
              className="flex-1 px-3 py-3 min-h-[44px] max-h-32 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors resize-none"
            />
            <button
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              aria-label="Send"
              className="press w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"
              style={{ backgroundColor: accent }}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      ) : (
        <p className="flex-shrink-0 pt-3 text-2xs text-gray-400">
          Your access is view-only, so you can read this conversation but not post.
        </p>
      )}
    </div>
  )
}
