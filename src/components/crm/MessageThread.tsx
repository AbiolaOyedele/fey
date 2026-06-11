'use client'

import { useEffect, useRef } from 'react'
import { MessageSquare, Paperclip } from 'lucide-react'
import type { CrmMessage } from '@/types/crm'
import RichTextComposer from './RichTextComposer'

interface MessageThreadProps {
  messages: CrmMessage[]
  ownerId: string
  onSend: (text: string, html: string) => Promise<void>
  showWelcomeBanner?: boolean
  loading?: boolean
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
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

export default function MessageThread({ messages, ownerId, onSend, showWelcomeBanner = false, loading = false }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

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
            <p className="text-[15px] font-medium text-gray-500">No messages yet</p>
            <p className="text-[13px] text-gray-400 mt-1">Start the conversation below.</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400 flex-shrink-0">{group.date}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <div className="space-y-3">
              {group.messages.map((msg) => {
                const isOwner = msg.sender_id === ownerId
                return (
                  <div key={msg.id} className={`flex gap-2 ${isOwner ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`max-w-[75%] ${isOwner ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isOwner
                            ? 'rounded-tr-sm text-white'
                            : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                        }`}
                        style={isOwner ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
                        dangerouslySetInnerHTML={{ __html: msg.body_html ?? msg.body.replace(/\n/g, '<br>') }}
                      />
                      {msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {msg.attachments.map((att, i) => (
                            <a
                              key={i}
                              href={att.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              <Paperclip size={10} className="inline-block mr-1" />{att.file_name}
                            </a>
                          ))}
                        </div>
                      )}
                      <span className="text-[10px] text-gray-300 px-1">{formatTime(msg.created_at)}</span>
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
        <RichTextComposer onSend={(text, html) => void onSend(text, html)} />
      </div>
    </div>
  )
}
