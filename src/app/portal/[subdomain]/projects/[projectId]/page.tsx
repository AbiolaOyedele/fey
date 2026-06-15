'use client'

import { use, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Paperclip, X, Loader2, Send, MessageSquare, FolderOpen, Download, FileText } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { portalBasePath } from '@/hooks/usePortalBase'
import { uploadToCloudinary } from '@/utils/cloudinary'
import { formatDate, formatTime } from '@/utils/formatDate'
import AttachmentPreview from '@/components/crm/AttachmentPreview'
import type { Project, ProjectMessage, ProjectFile } from '@/types/project'
import type { MessageAttachment } from '@/types/crm'

type Pane = 'chat' | 'files'

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function PortalProjectDetailPage({ params }: { params: Promise<{ subdomain: string; projectId: string }> }) {
  const { subdomain, projectId } = use(params)
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [token, setToken] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [pane, setPane] = useState<Pane>('chat')

  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [uploading, setUploading] = useState(0)
  const [fileUploading, setFileUploading] = useState(false)

  useEffect(() => {
    void (async () => {
      const t = localStorage.getItem(portalTokenKey(subdomain))
      if (!t) { setLoading(false); return }
      setToken(t)
      const res = await fetch(`/api/v1/portal/projects/${projectId}`, { headers: { Authorization: `Bearer ${t}` } })
      if (res.ok) {
        const d = await res.json() as { project: Project; messages: ProjectMessage[]; files: ProjectFile[] }
        setProject(d.project)
        setMessages(d.messages ?? [])
        setFiles(d.files ?? [])
      }
      setLoading(false)
    })()
  }, [subdomain, projectId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, pane])

  const handleAttach = useCallback(async (list: FileList | null) => {
    if (!list || list.length === 0) return
    for (const file of Array.from(list)) {
      setUploading((n) => n + 1)
      try {
        const { url, size } = await uploadToCloudinary(file, 'portal-projects').promise
        setAttachments((prev) => [...prev, { file_name: file.name, file_url: url, file_type: file.type || 'application/octet-stream', file_size: size }])
      } catch { /* user can retry */ } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const send = useCallback(async () => {
    if ((!body.trim() && attachments.length === 0) || !token || uploading > 0) return
    setSending(true)
    const res = await fetch(`/api/v1/portal/projects/${projectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ body: body.trim() || '(file)', body_html: null, attachments }),
    })
    if (res.ok) {
      const d = await res.json() as { message: ProjectMessage }
      setMessages((prev) => [...prev, d.message])
      setBody('')
      setAttachments([])
    }
    setSending(false)
  }, [body, token, attachments, uploading, projectId])

  const uploadProjectFile = useCallback(async (list: FileList | null) => {
    if (!list || list.length === 0 || !token) return
    setFileUploading(true)
    try {
      for (const file of Array.from(list)) {
        const { url, publicId, size } = await uploadToCloudinary(file, 'portal-projects').promise
        const res = await fetch(`/api/v1/portal/projects/${projectId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ file_name: file.name, file_url: url, public_id: publicId, file_size: size, file_type: file.type || null }),
        })
        if (res.ok) {
          const d = await res.json() as { file: ProjectFile }
          setFiles((prev) => [d.file, ...prev])
        }
      }
    } catch { /* user can retry */ } finally {
      setFileUploading(false)
    }
  }, [token, projectId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`${portalBasePath(subdomain)}/projects`)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={15} /> Projects
          </button>
          {project && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-medium text-gray-900 truncate">{project.title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 mt-3">
          <button
            onClick={() => setPane('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${pane === 'chat' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
            style={pane === 'chat' ? { backgroundColor: '#101010' } : {}}
          >
            <MessageSquare size={13} /> Chat
          </button>
          <button
            onClick={() => setPane('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${pane === 'files' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
            style={pane === 'files' ? { backgroundColor: '#101010' } : {}}
          >
            <FolderOpen size={13} /> Files
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : pane === 'chat' ? (
        <>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center text-gray-400">
                <p className="text-sm">No messages yet. Start the conversation below.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_type === 'client'
                const bodyText = msg.body === '(file)' ? '' : msg.body
                const hasBody = !!(msg.body_html?.trim() || bodyText.trim())
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}>
                      {hasBody && (
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isMe ? 'text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'}`}
                          style={isMe ? { backgroundColor: '#101010' } : {}}
                        >
                          {msg.body_html ? (
                            <div dangerouslySetInnerHTML={{ __html: msg.body_html }} className="prose prose-sm max-w-none" />
                          ) : bodyText}
                        </div>
                      )}
                      {msg.attachments.length > 0 && <AttachmentPreview attachments={msg.attachments} />}
                      <span className="text-3xs text-gray-400 px-1">{formatTime(msg.created_at)}</span>
                    </div>
                  </div>
                )
              })
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
                    <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="w-4 h-4 rounded flex items-center justify-center hover:bg-gray-200 text-gray-400">
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {uploading > 0 && <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 px-2 py-1"><Loader2 size={11} className="animate-spin" /> Uploading…</span>}
              </div>
            )}
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} title="Attach file" className="p-2.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex-shrink-0">
                <Paperclip size={18} />
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => void handleAttach(e.target.files)} />
              <textarea
                rows={1}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() } }}
                placeholder="Type a message… (⌘↵ to send)"
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white resize-none max-h-32"
              />
              <button
                onClick={() => void send()}
                disabled={sending || uploading > 0 || (!body.trim() && attachments.length === 0)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 flex-shrink-0 flex items-center gap-1.5"
                style={{ backgroundColor: '#101010' }}
              >
                <Send size={13} /> Send
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-400">{files.length} file{files.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={fileUploading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#101010' }}
            >
              {fileUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} Upload
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => void uploadProjectFile(e.target.files)} />
          </div>
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen size={28} className="text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">No files yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 h-14 px-4 border-b border-gray-100 last:border-b-0">
                  <FileText size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                    {file.file_size && <p className="text-2xs text-gray-400">{fmtSize(file.file_size)}</p>}
                  </div>
                  <span className="text-2xs text-gray-400 flex-shrink-0 hidden sm:inline">{formatDate(file.created_at)}</span>
                  <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-gray-400 hover:text-gray-700">
                    <Download size={15} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
