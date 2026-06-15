'use client'

import { useRef, useState, useCallback, useEffect, type KeyboardEvent } from 'react'
import { z } from 'zod'
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

// Only http(s) links are allowed. Bare domains get https:// prepended before validation.
const linkSchema = z
  .string()
  .trim()
  .min(1, 'Enter a link.')
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .pipe(z.string().url('That doesn’t look like a valid link.'))
  .refine((v) => /^https?:\/\//i.test(v), 'Links must start with http:// or https://')

export default function RichTextComposer({ onSend, placeholder = 'Write a message…', disabled = false }: RichTextComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [uploading,   setUploading]   = useState(0)
  const [error,       setError]       = useState('')

  // In-app link popup (replaces window.prompt)
  const [linkOpen,  setLinkOpen]  = useState(false)
  const [linkUrl,   setLinkUrl]   = useState('')
  const [linkText,  setLinkText]  = useState('')
  const [linkError, setLinkError] = useState('')
  const savedRange = useRef<Range | null>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)

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

  const openLinkPopup = useCallback(() => {
    // Capture the current selection inside the editor before the input steals focus.
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
      setLinkText(sel.toString())
    } else {
      savedRange.current = null
      setLinkText('')
    }
    setLinkUrl('')
    setLinkError('')
    setLinkOpen(true)
  }, [])

  const closeLinkPopup = useCallback(() => {
    setLinkOpen(false)
    setLinkError('')
  }, [])

  const applyLink = useCallback(() => {
    const parsed = linkSchema.safeParse(linkUrl)
    if (!parsed.success) {
      setLinkError(parsed.error.issues[0]?.message ?? 'Enter a valid link.')
      return
    }
    const href = parsed.data
    const el = editorRef.current
    if (!el) return
    el.focus()

    const sel = window.getSelection()
    if (savedRange.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    const hadSelection = savedRange.current && !savedRange.current.collapsed
    const safeText = (linkText.trim() || href).replace(/[<>&"]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c),
    )

    if (hadSelection) {
      execCmd('createLink', href)
    } else {
      execCmd('insertHTML', `<a href="${href}" target="_blank" rel="noopener noreferrer">${safeText}</a>&nbsp;`)
    }
    savedRange.current = null
    closeLinkPopup()
  }, [linkUrl, linkText, closeLinkPopup])

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus()
  }, [linkOpen])

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
        <div className="relative">
          <button
            type="button"
            title="Insert link"
            aria-haspopup="dialog"
            aria-expanded={linkOpen}
            onMouseDown={(e) => { e.preventDefault(); openLinkPopup() }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Link size={14} />
          </button>
          {linkOpen && (
            <div
              role="dialog"
              aria-label="Insert link"
              className="absolute z-20 top-9 left-0 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-3"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <label className="block text-2xs font-medium text-gray-500 mb-1">Link</label>
              <input
                ref={linkInputRef}
                type="url"
                value={linkUrl}
                onChange={(e) => { setLinkUrl(e.target.value); setLinkError('') }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                  if (e.key === 'Escape') { e.preventDefault(); closeLinkPopup() }
                }}
                placeholder="https://example.com"
                className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gray-400"
              />
              <label className="block text-2xs font-medium text-gray-500 mt-2 mb-1">Text to display (optional)</label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                  if (e.key === 'Escape') { e.preventDefault(); closeLinkPopup() }
                }}
                placeholder="Link text"
                className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gray-400"
              />
              {linkError && <p className="text-xs text-red-500 mt-1.5">{linkError}</p>}
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={closeLinkPopup}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyLink}
                  className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                >
                  Add link
                </button>
              </div>
            </div>
          )}
        </div>
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
