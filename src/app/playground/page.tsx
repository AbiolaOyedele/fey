'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Hash, Send, MessagesSquare } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useTeam } from '@/hooks/useTeam'
import { useInternalChat } from '@/hooks/useInternalChat'

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function PlaygroundPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const accent = settings.accent_color ?? '#ED64A6'

  const { workspace, loading: wsLoading } = useWorkspace()
  const { members } = useTeam(workspace?.id ?? null)
  const {
    channels, activeChannelId, setActiveChannel,
    messages, loadingMessages, sending, send,
  } = useInternalChat(workspace?.id ?? null)

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const mem of members) m.set(mem.user_id, mem.name ?? mem.email ?? 'Teammate')
    return m
  }, [members])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    await send(body)
  }

  const activeChannel = channels.find((c) => c.id === activeChannelId)

  return (
    <div className="flex flex-col h-screen p-4 md:p-6 lg:p-8 page-enter">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <MessagesSquare size={18} style={{ color: accent }} />
        <h1 className="font-display text-xl font-normal text-gray-800">Internal Chats</h1>
        <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Playground</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">A private space for your team — clients never see this.</p>

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex overflow-hidden">
        {/* Channels rail */}
        <div className="w-44 border-r border-gray-100 p-3 hidden sm:flex flex-col gap-1 flex-shrink-0">
          <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1">Channels</p>
          {channels.map((c) => {
            const isActive = c.id === activeChannelId
            return (
              <button
                key={c.id}
                onClick={() => setActiveChannel(c.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left ${
                  isActive ? '' : 'text-gray-500 hover:bg-gray-50'
                }`}
                style={isActive ? { backgroundColor: `${accent}15`, color: accent } : {}}
              >
                <Hash size={13} className="flex-shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
            )
          })}
        </div>

        {/* Conversation */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-1.5 flex-shrink-0">
            <Hash size={15} className="text-gray-400" />
            <span className="font-semibold text-gray-800 text-sm">{activeChannel?.name ?? 'general'}</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {wsLoading || loadingMessages ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              ))
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <MessagesSquare size={32} className="text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">No messages yet</p>
                <p className="text-xs text-gray-400 mt-1">Say hello to your team 👋</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.sender_id === user?.id
                const senderName = isMine ? 'You' : (nameById.get(m.sender_id) ?? 'Teammate')
                return (
                  <div key={m.id} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                      style={{ backgroundColor: isMine ? accent : '#9CA3AF' }}
                    >
                      {initials(senderName === 'You' ? (members.find((mem) => mem.user_id === user?.id)?.name ?? 'Y') : senderName)}
                    </div>
                    <div className={`max-w-[75%] ${isMine ? 'items-end text-right' : ''} flex flex-col`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-gray-700">{senderName}</span>
                        <span className="text-3xs text-gray-400">{timeLabel(m.created_at)}</span>
                      </div>
                      <div
                        className="px-3 py-2 rounded-2xl text-sm break-words"
                        style={isMine
                          ? { backgroundColor: accent, color: '#fff' }
                          : { backgroundColor: '#F3F4F6', color: '#1F2937' }}
                      >
                        {m.body}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-100 p-3 flex items-center gap-2 flex-shrink-0">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
              placeholder={`Message #${activeChannel?.name ?? 'general'}`}
              disabled={!workspace}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!draft.trim() || sending || !workspace}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-opacity disabled:opacity-40 hover:opacity-90 flex-shrink-0"
              style={{ backgroundColor: accent }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
