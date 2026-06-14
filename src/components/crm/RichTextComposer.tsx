'use client'

import { useRef, useState, useCallback, type KeyboardEvent } from 'react'
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Link, Send, Paperclip, X, Loader2,
} from 'lucide-react'
import { uploadToCloudinary, formatFileSize } from '@/utils/cloudinary'
import EmojiPicker from './EmojiPicker'
import type { MessageAttachment } from '@/types/crm'

interface RichTextComposerProps {
  onSend: (text: string, html: string, attachments: MessageAttachment[]) => void
  placeholder?: string
  disabled?: boolean
}

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB

export default function RichTextComposer({ onSend, placeholder = 'Write a message…', disabled = false }: RichTextComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [uploading,   setUploading]   = useState(0)
  const [error,       setError]       = useState('')

  const isEmpty = useCallback(() => {
    const el = editorRef.current
    if (!el) return true
    return (el.innerText.trim() === '' && el.innerHTML === '') || el.innerHTML === '<br>'
  }, [])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" is larger than 25 MB.`)
        continue
      }
      setUploading((n) => n + 1)
      try {
        const { url, size } = await uploadToCloudinary(file, 'messages').promise
        setAttachments((prev) => [
          ...prev,
          { file_name: file.name, file_url: url, file_type: file.type || 'application/octet-stream', file_size: size },
        ])
      } catch {
        setError(`Couldn't upload "${file.name}". Please try again.`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx))

  const handleSend = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const text = el.innerText.trim()
    const html = el.innerHTML
    if ((isEmpty() && attachments.length === 0) || uploading > 0) return
    onSend(text, html, attachments)
    el.innerHTML = ''
    setAttachments([])
    setError('')
    el.focus()
  }, [onSend, isEmpty, attachments, uploading])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleLink = useCallback(() => {
    const url = window.prompt('Enter URL:')
    if (url) execCmd('createLink', url)
  }, [])

  const toolbarButtons = [
    { icon: Bold,          title: 'Bold',           cmd: 'bold' },
    { icon: Italic,        title: 'Italic',         cmd: 'italic' },
    { icon: Underline,     title: 'Underline',      cmd: 'underline' },
    { icon: Strikethrough, title: 'Strikethrough',  cmd: 'strikeThrough' },
    { icon: List,          title: 'Bullet list',    cmd: 'insertUnorderedList' },
    { icon: ListOrdered,   title: 'Numbered list',  cmd: 'insertOrderedList' },
  ] as const

  const canSend = !disabled && uploading === 0

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100">
        {toolbarButtons.map(({ icon: Icon, title, cmd }) => (
          <button
            key={cmd}
            type="button"
            title={title}
            onMouseDown={(e) => { e.preventDefault(); execCmd(cmd) }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Icon size={14} />
          </button>
        ))}
        <button
          type="button"
          title="Insert link"
          onMouseDown={(e) => { e.preventDefault(); handleLink() }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Link size={14} />
        </button>
        <button
          type="button"
          title="Attach file"
          onClick={() => fileRef.current?.click()}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Paperclip size={14} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <EmojiPicker
          className="w-7 h-7"
          onPick={(emoji) => {
            const el = editorRef.current
            if (!el) return
            el.focus()
            execCmd('insertText', emoji)
          }}
        />
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="min-h-[80px] max-h-[200px] overflow-y-auto px-4 py-3 text-sm text-gray-800 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 prose prose-sm max-w-none"
      />

      {/* Pending attachments */}
      {(attachments.length > 0 || uploading > 0) && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {attachments.map((att, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg pl-2 pr-1 py-1">
              <Paperclip size={11} className="text-gray-400" />
              <span className="max-w-[160px] truncate">{att.file_name}</span>
              <span className="text-gray-400">{formatFileSize(att.file_size)}</span>
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="w-4 h-4 rounded flex items-center justify-center hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {uploading > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 rounded-lg px-2 py-1">
              <Loader2 size={11} className="animate-spin" />
              Uploading…
            </span>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 px-4 pb-1">{error}</p>}

      {/* Send row */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
        <span className="text-2xs text-gray-300">⌘ Enter to send</span>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
        >
          <Send size={13} />
          Send
        </button>
      </div>
    </div>
  )
}
