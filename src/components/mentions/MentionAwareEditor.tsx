'use client'

import {
  useRef, useEffect, useCallback, forwardRef, useImperativeHandle,
  type KeyboardEvent, type ClipboardEvent, type DragEvent,
} from 'react'
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete'
import MentionMenu from './MentionMenu'
import { buildMentionHtml, serializeMentionEditor, mentionChipHtml, imageChipHtml, isHostedImageUrl } from '@/utils/mentions'
import { caretOffset, escapeHtml } from '@/utils/contentEditableCaret'
import type { WorkspaceMember } from '@/types/team'

/** Result of hosting a pasted image — only the URL is ever stored in the text. */
export interface EditorImageUpload {
  url: string
  name: string
}

/** Transient chip shown in place of an image while it uploads. */
function uploadingChipHtml(uploadId: string, fileName: string): string {
  return (
    `<span data-upload-id="${escapeHtml(uploadId)}" contenteditable="false" ` +
    `style="display:inline-block;padding:0.125rem 0.5rem;border-radius:0.5rem;background:#f3f4f6;color:#6b7280;font-size:0.75rem;">` +
    `Uploading ${escapeHtml(fileName)}…</span>`
  )
}

const imageFilesOf = (list: FileList | null): File[] =>
  Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))

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
  /**
   * Enables pasting/dropping images: hosts the file and returns its URL, which
   * is what gets embedded in the value. Without this prop, images are ignored
   * (as before) and pasting stays text-only.
   */
  uploadImage?: (file: File) => Promise<EditorImageUpload>
  /** Called with a plain-English message when an image upload fails. */
  onImageError?: (message: string) => void
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
  { initialValue, workspaceId, onCommit, onEscape, multiline = false, placeholder, autoFocus, className = '', onEmptyChange, uploadImage, onImageError },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  const initialRef = useRef(initialValue)
  const suppressBlur = useRef(false)
  // Blurring mid-upload must not save a value whose image is still a
  // placeholder — the commit is held back until the last upload settles.
  const pendingUploads = useRef(0)
  const deferredCommit = useRef(false)
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

  const commitNow = useCallback(() => {
    const el = elRef.current
    if (!el) return
    onCommit(serializeMentionEditor(el))
  }, [onCommit])

  const commit = useCallback(() => {
    if (suppressBlur.current) { suppressBlur.current = false; return }
    if (pendingUploads.current > 0) { deferredCommit.current = true; return }
    commitNow()
  }, [commitNow])

  /**
   * Uploads a pasted/dropped image, showing a placeholder chip at the caret
   * until the hosted URL comes back. Only the URL ends up in the value.
   */
  const insertImage = useCallback(async (file: File) => {
    if (!uploadImage) return
    const el = elRef.current
    if (!el) return
    const uploadId = crypto.randomUUID()
    document.execCommand('insertHTML', false, uploadingChipHtml(uploadId, file.name || 'image'))
    pendingUploads.current += 1
    try {
      const { url, name } = await uploadImage(file)
      if (!isHostedImageUrl(url)) throw new Error('That image couldn’t be saved. Please try again.')
      const placeholder = el.querySelector(`[data-upload-id="${uploadId}"]`)
      if (placeholder) placeholder.outerHTML = imageChipHtml(name, url)
      else el.insertAdjacentHTML('beforeend', imageChipHtml(name, url))
      onEmptyChange?.(false)
    } catch (err) {
      el.querySelector(`[data-upload-id="${uploadId}"]`)?.remove()
      if (!(err instanceof Error && err.message === 'cancelled')) {
        onImageError?.(err instanceof Error ? err.message : 'That image couldn’t be uploaded.')
      }
    } finally {
      pendingUploads.current -= 1
      if (pendingUploads.current === 0 && deferredCommit.current) {
        deferredCommit.current = false
        commitNow()
      }
    }
  }, [uploadImage, onImageError, onEmptyChange, commitNow])

  const handlePaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    const images = uploadImage ? imageFilesOf(e.clipboardData.files) : []
    if (images.length > 0) {
      e.preventDefault()
      for (const file of images) void insertImage(file)
      return
    }
    // Everything else pastes as plain text: keeps foreign markup and its
    // styling out of the editor, and out of the serialized value.
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    document.execCommand('insertText', false, text)
    handleInput()
  }, [uploadImage, insertImage, handleInput])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    const images = uploadImage ? imageFilesOf(e.dataTransfer.files) : []
    if (images.length === 0) return
    e.preventDefault()
    const el = elRef.current
    if (!el) return
    el.focus()
    // Drop the image where it was dropped, not wherever the caret happened to be.
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY)
    if (range && el.contains(range.startContainer)) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    for (const file of images) void insertImage(file)
  }, [uploadImage, insertImage])

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
        onPaste={handlePaste}
        onDrop={handleDrop}
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
