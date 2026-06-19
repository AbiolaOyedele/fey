'use client'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { formatDate } from '@/utils/formatDate'

import { use, useState, useEffect, useRef, useCallback } from 'react'
import { Paperclip, X, Loader2, Send } from 'lucide-react'
import { uploadToCloudinary } from '@/utils/cloudinary'
import AttachmentPreview from '@/components/crm/AttachmentPreview'
import EmojiPicker from '@/components/crm/EmojiPicker'
import { composerKeyDown } from '@/utils/composerKeys'
import type { CrmMessage, MessageAttachment } from '@/types/crm'

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB

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
  return formatDate(d)
}

export default function PortalMessagesPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const bottomRef     = useRef<HTMLDivElement>(null)
  const fileRef       = useRef<HTMLInputElement>(null)

  const [messages, setMessages]   = useState<CrmMessage[]>([])
  const [loading,  setLoading]    = useState(true)
  const [token,    setToken]      = useState('')
  const [body,     setBody]       = useState('')
  const [sending,  setSending]    = useState(false)
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [uploading,   setUploading]   = useState(0)
  const [readReceipts, setReadReceipts] = useState(true)

  useEffect(() => {
    void (async () => {
      const portalToken = localStorage.getItem(portalTokenKey(subdomain))
      if (!portalToken) { setLoading(false); return }
      setToken(portalToken)
      const data = await apiFetch<{ messages: CrmMessage[]; read_receipts?: boolean }>('/api/v1/portal/messages', portalToken)
      setMessages(data.messages ?? [])
      setReadReceipts(data.read_receipts ?? true)
      setLoading(false)
    })()
  }, [subdomain])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) continue
      setUploading((n) => n + 1)
      try {
        const { url, size } = await uploadToCloudinary(file, 'portal-messages').promise
        setAttachments((prev) => [
          ...prev,
          { file_name: file.name, file_url: url, file_type: file.type || 'application/octet-stream', file_size: size },
        ])
      } catch {
        /* swallow — user can retry */
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const send = useCallback(async () => {
    if ((!body.trim() && attachments.length === 0) || !token || uploading > 0) return
    setSending(true)
    const data = await apiFetch<{ message: CrmMessage }>('/api/v1/portal/messages', token, {
      method: 'POST',
      body: JSON.stringify({ body: body.trim() || '(file)', body_html: null, attachments }),
    })
    setMessages((prev) => [...prev, data.message])
    setBody('')
    setAttachments([])
    setSending(false)
  }, [body, token, attachments, uploading])

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
                  // The owner side stores '(file)' as a placeholder body for
                  // file-only messages — don't render that as text.
                  const bodyText = msg.body === '(file)' ? '' : msg.body
                  const hasBody = !!(msg.body_html?.trim() || bodyText.trim())
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}>
                        {hasBody && (
                          <div
                            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                              isMe ? 'text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                            }`}
                            style={isMe ? { backgroundColor: '#101010' } : {}}
                          >
                            {msg.body_html ? (
                              <div dangerouslySetInnerHTML={{ __html: msg.body_html }} className="prose prose-sm max-w-none" />
                            ) : (
                              bodyText
                            )}
                          </div>
                        )}

                        {msg.attachments.length > 0 && <AttachmentPreview attachments={msg.attachments} />}

                        <span className="text-3xs text-gray-400 px-1">
                          {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {isMe && readReceipts && (msg.read_at ? ' · Read' : ' · Sent')}
                        </span>
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
        {(attachments.length > 0 || uploading > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((att, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg pl-2 pr-1 py-1">
                <Paperclip size={11} className="text-gray-400" />
                <span className="max-w-[160px] truncate">{att.file_name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="w-4 h-4 rounded flex items-center justify-center hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {uploading > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 px-2 py-1">
                <Loader2 size={11} className="animate-spin" /> Uploading…
              </span>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Attach file"
            className="p-2.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <Paperclip size={18} />
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
          <EmojiPicker className="p-2.5 flex-shrink-0" onPick={(emoji) => setBody((b) => b + emoji)} />
          <textarea
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => composerKeyDown(e, () => void send(), setBody)}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors resize-none max-h-32"
          />
          <button
            onClick={() => void send()}
            disabled={sending || uploading > 0 || (!body.trim() && attachments.length === 0)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0 flex items-center gap-1.5"
            style={{ backgroundColor: '#101010' }}
          >
            <Send size={13} />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
