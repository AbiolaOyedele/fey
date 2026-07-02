'use client'

import { useEffect, useRef, useState } from 'react'
import { formatDate as fmtDate } from '@/utils/formatDate'
import { MessageSquare } from 'lucide-react'
import type { CrmMessage, MessageAttachment } from '@/types/crm'
import RichTextComposer from './RichTextComposer'
import AttachmentPreview from './AttachmentPreview'

interface MessageThreadProps {
  messages: CrmMessage[]
  ownerId: string
  workspaceId?: string | null
  contactName?: string
  onSend: (text: string, html: string, attachments: MessageAttachment[]) => Promise<void>
  showWelcomeBanner?: boolean
  loading?: boolean
  /** Scrolls to and briefly highlights this message on mount (e.g. from a mention notification link). */
  highlightMessageId?: string | null
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return fmtDate(d)
}

function groupByDate(messages: CrmMessage[]): Array<{ date: string; messages: CrmMessage[] }> {
  const groups: Array<{ date: string; messages: CrmMessage[] }> = []
  for (const msg of messages) {
    const date = formatDate(msg.created_at)
    const last = groups[groups.length - 1]
    if (last?.date === date) {
      last.messages.push(msg)
    } else {
      groups.push({ date, messages: [msg] })
    }
  }
  return groups
}

export default function MessageThread({
  messages, ownerId, workspaceId = null, contactName = 'Client', onSend,
  showWelcomeBanner = false, loading = false, highlightMessageId = null,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    if (highlightMessageId) return // deep-link scroll takes priority over autoscroll
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, highlightMessageId])

  useEffect(() => {
    if (!highlightMessageId || loading) return
    const el = messageRefs.current.get(highlightMessageId)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setHighlightId(highlightMessageId)
    const t = setTimeout(() => setHighlightId(null), 2000)
    return () => clearTimeout(t)
  }, [highlightMessageId, loading, messages])

  const groups = groupByDate(messages)

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {showWelcomeBanner && messages.length === 0 && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 flex-shrink-0">
              <MessageSquare size={14} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">Welcome message is set</p>
              <p className="text-xs text-blue-500 mt-0.5">Your welcome message will be sent when the client logs in for the first time.</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <MessageSquare size={22} className="text-gray-300" />
            </div>
            <p className="text-sm2 font-medium text-gray-500">No messages yet</p>
            <p className="text-xs2 text-gray-400 mt-1">Start the conversation below.</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-2xs text-gray-400 flex-shrink-0">{group.date}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <div className="space-y-3">
              {group.messages.map((msg) => {
                const isOwner = msg.sender_id === ownerId
                const senderName = isOwner ? 'You' : contactName
                const hasBody = !!(msg.body_html?.trim() || msg.body.trim())
                return (
                  <div
                    key={msg.id}
                    ref={(el) => { if (el) messageRefs.current.set(msg.id, el); else messageRefs.current.delete(msg.id) }}
                    className={`flex gap-3 rounded-xl transition-colors duration-500 ${isOwner ? 'flex-row-reverse' : 'flex-row'} ${highlightId === msg.id ? 'bg-amber-50' : ''}`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                      style={{ backgroundColor: isOwner ? 'var(--accent, #ED64A6)' : '#9CA3AF' }}
                    >
                      {initial(senderName)}
                    </div>
                    <div className={`max-w-[75%] flex flex-col ${isOwner ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        {!isOwner && <span className="text-xs font-semibold text-gray-700">{senderName}</span>}
                        <span className="text-3xs text-gray-400">
                          {formatTime(msg.created_at)}{isOwner && (msg.read_at ? ' · Read' : ' · Sent')}
                        </span>
                      </div>
                      {hasBody && (
                        <div
                          className={`px-3.5 py-2 text-sm leading-relaxed break-words rounded-2xl ${isOwner ? 'rounded-br-sm text-white' : 'rounded-bl-sm text-gray-800'}`}
                          style={isOwner ? { backgroundColor: 'var(--accent, #ED64A6)' } : { backgroundColor: '#F3F4F6' }}
                          dangerouslySetInnerHTML={{ __html: msg.body_html ?? msg.body.replace(/\n/g, '<br>') }}
                        />
                      )}
                      {msg.attachments.length > 0 && (
                        <AttachmentPreview attachments={msg.attachments} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 px-6 pb-6 pt-2">
        <RichTextComposer onSend={(text, html, attachments) => void onSend(text, html, attachments)} workspaceId={workspaceId} />
      </div>
    </div>
  )
}
