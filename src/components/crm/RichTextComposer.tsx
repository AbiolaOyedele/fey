'use client'

import { useRef, useCallback, type KeyboardEvent } from 'react'
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Link, Send,
} from 'lucide-react'

interface RichTextComposerProps {
  onSend: (text: string, html: string) => void
  placeholder?: string
  disabled?: boolean
}

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}

export default function RichTextComposer({ onSend, placeholder = 'Write a message…', disabled = false }: RichTextComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  const isEmpty = useCallback(() => {
    const el = editorRef.current
    if (!el) return true
    return el.innerText.trim() === '' && el.innerHTML === '' || el.innerHTML === '<br>'
  }, [])

  const handleSend = useCallback(() => {
    const el = editorRef.current
    if (!el || isEmpty()) return
    const text = el.innerText.trim()
    const html = el.innerHTML
    onSend(text, html)
    el.innerHTML = ''
    el.focus()
  }, [onSend, isEmpty])

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

      {/* Send row */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
        <span className="text-[11px] text-gray-300">⌘ Enter to send</span>
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled}
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
