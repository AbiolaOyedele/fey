'use client'

import { use, useState, useEffect, useRef, useCallback } from 'react'
import type { CrmMessage } from '@/types/crm'

function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  }).then((r) => r.json() as Promise<T>)
}

function groupByDate(msgs: CrmMessage[]): Array<{ date: string; messages: CrmMessage[] }> {
  const map = new Map<string, CrmMessage[]>()
  for (const m of msgs) {
    const day = m.created_at.slice(0, 10)
    const group = map.get(day) ?? []
    group.push(m)
    map.set(day, group)
  }
  return Array.from(map.entries()).map(([date, messages]) => ({ date, messages }))
}

function fmtDate(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  if (iso.slice(0, 10) === now.toISOString().slice(0, 10)) return 'Today'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function PortalMessagesPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const bottomRef     = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<CrmMessage[]>([])
  const [loading,  setLoading]  = useState(true)
  const [token,    setToken]    = useState('')
  const [body,     setBody]     = useState('')
  const [sending,  setSending]  = useState(false)

  useEffect(() => {
    void (async () => {
      const portalToken = localStorage.getItem(`portal_token_${subdomain}`)
      if (!portalToken) { setLoading(false); return }
      setToken(portalToken)
      const data = await apiFetch<{ messages: CrmMessage[] }>('/api/v1/portal/messages', portalToken)
      setMessages(data.messages ?? [])
      setLoading(false)
    })()
  }, [subdomain])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    if (!body.trim() || !token) return
    setSending(true)
    const data = await apiFetch<{ message: CrmMessage }>('/api/v1/portal/messages', token, {
      method: 'POST',
      body: JSON.stringify({ body: body.trim(), body_html: null }),
    })
    setMessages((prev) => [...prev, data.message])
    setBody('')
    setSending(false)
  }, [body, token])

  const groups = groupByDate(messages)

  return (
    <div className="flex flex-col h-full">
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-12 rounded-2xl bg-gray-100 animate-pulse ${i % 2 === 0 ? 'w-3/4' : 'w-1/2 ml-auto'}`} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center text-gray-400">
            <p className="text-sm">No messages yet. Start the conversation below.</p>
          </div>
        ) : (
          groups.map(({ date, messages: dayMsgs }) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">{fmtDate(date)}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-3">
                {dayMsgs.map((msg) => {
                  // Portal clients always have sender_type === 'client'
                  const isMe = msg.sender_type === 'client'
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isMe ? 'text-white' : 'bg-white border border-gray-100 text-gray-800'
                        }`}
                        style={isMe ? { backgroundColor: '#101010' } : {}}
                      >
                        {msg.body_html ? (
                          <div dangerouslySetInnerHTML={{ __html: msg.body_html }} className="prose prose-sm max-w-none" />
                        ) : (
                          msg.body
                        )}
                        <p className={`text-[10px] mt-1.5 ${isMe ? 'text-white/50' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() } }}
            placeholder="Type a message… (⌘↵ to send)"
            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors resize-none max-h-32"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !body.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
            style={{ backgroundColor: '#101010' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
