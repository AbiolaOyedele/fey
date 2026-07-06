'use client'

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, type KeyboardEvent } from 'react'
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete'
import MentionMenu from './MentionMenu'
import { buildMentionHtml, serializeMentionEditor, mentionChipHtml } from '@/utils/mentions'
import { caretOffset } from '@/utils/contentEditableCaret'
import type { WorkspaceMember } from '@/types/team'

export interface MentionAwareEditorHandle {
  clear: () => void
  focus: () => void
  blur: () => void
  getValue: () => string
  /** Inserts plain text at the current caret position (e.g. an emoji pick). */
  insertText: (text: string) => void
}

interface MentionAwareEditorProps {
  /** Read once on mount to seed the editor — this is an uncontrolled component. */
  initialValue: string
  workspaceId: string | null | undefined
  /** Fires on blur with the latest serialized (token-string) value. */
  onCommit: (value: string) => void
  /** Escape reverts — fires instead of onCommit. */
  onEscape?: () => void
  /** Multiline: Enter inserts a newline. Single-line (default): Enter blurs (triggers onCommit). */
  multiline?: boolean
  placeholder?: string
  autoFocus?: boolean
  className?: string
  /** Cheap live signal (no serialization) for e.g. disabling a send button while empty. */
  onEmptyChange?: (isEmpty: boolean) => void
}

/**
 * A plain-text editor (renders a mention token string, e.g. task descriptions
 * or chat drafts) that shows picked @mentions as real inline chips instead of
 * raw "@[Name](user:id)" text. Built on a contenteditable div so the chip can
 * render inline; storage/extraction still use the same plain-text token
 * format as everywhere else (see src/utils/mentions.tsx) — this component
 * only changes what's shown while composing.
 */
const MentionAwareEditor = forwardRef<MentionAwareEditorHandle, MentionAwareEditorProps>(function MentionAwareEditor(
  { initialValue, workspaceId, onCommit, onEscape, multiline = false, placeholder, autoFocus, className = '', onEmptyChange },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  const initialRef = useRef(initialValue)
  const suppressBlur = useRef(false)
  const mention = useMentionAutocomplete(workspaceId)

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    el.innerHTML = buildMentionHtml(initialRef.current)
    if (multiline) document.execCommand('defaultParagraphSeparator', false, 'br')
    if (autoFocus) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    // Seed once on mount only — this is an uncontrolled editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    clear: () => { if (elRef.current) elRef.current.innerHTML = '' },
    focus: () => elRef.current?.focus(),
    blur: () => elRef.current?.blur(),
    getValue: () => (elRef.current ? serializeMentionEditor(elRef.current) : ''),
    insertText: (text: string) => {
      const el = elRef.current
      if (!el) return
      el.focus()
      document.execCommand('insertText', false, text)
    },
  }), []) // stable handle (closes over the elRef object, not its value) — without this,
  // a new object every render makes a callback ref (e.g. `ref={setState}`) fire on
  // every render, which re-renders forever (React error #185, "Maximum update depth").

  const handleInput = useCallback(() => {
    const el = elRef.current
    if (!el) return
    mention.onTextChange(el.innerText, caretOffset(el))
    onEmptyChange?.(el.innerText.trim().length === 0 && el.querySelector('[data-mention]') === null)
  }, [mention, onEmptyChange])

  const pickMention = useCallback((member: WorkspaceMember) => {
    const el = elRef.current
    if (!el || !mention.trigger) return
    el.focus()
    const sel = window.getSelection()
    if (sel) {
      const charsToSelect = mention.trigger.query.length + 1 // +1 for the '@'
      for (let i = 0; i < charsToSelect; i++) sel.modify('extend', 'backward', 'character')
    }
    const name = member.name || member.email || 'Member'
    document.execCommand('insertHTML', false, mentionChipHtml(name, member.user_id) + '&nbsp;')
    mention.close()
  }, [mention])

  const commit = useCallback(() => {
    if (suppressBlur.current) { suppressBlur.current = false; return }
    const el = elRef.current
    if (!el) return
    onCommit(serializeMentionEditor(el))
  }, [onCommit])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (mention.trigger) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mention.moveActive(1); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); mention.moveActive(-1); return }
      if (e.key === 'Enter' && mention.matches.length > 0) {
        e.preventDefault()
        pickMention(mention.matches[mention.activeIndex])
        return
      }
      if (e.key === 'Escape') { mention.close(); return }
    }
    if (e.key === 'Escape' && onEscape) {
      suppressBlur.current = true
      onEscape()
      elRef.current?.blur()
      return
    }
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault()
      elRef.current?.blur()
    }
  }, [mention, pickMention, onEscape, multiline])

  return (
    <div className="relative">
      <div
        ref={elRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        data-placeholder={placeholder}
        className={`outline-none whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 ${className}`}
      />
      {mention.trigger && (
        <MentionMenu
          matches={mention.matches}
          activeIndex={mention.activeIndex}
          onHover={mention.setActiveIndex}
          onPick={pickMention}
          className={multiline ? 'absolute left-0 top-full mt-1' : 'absolute left-0 bottom-full mb-1'}
        />
      )}
    </div>
  )
})

export default MentionAwareEditor
