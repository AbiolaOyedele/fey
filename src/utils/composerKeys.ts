import type { KeyboardEvent } from 'react'

/**
 * Shared chat-composer key behaviour for <textarea> composers:
 *   • Enter            → send
 *   • Shift+Enter      → newline (textarea default)
 *   • Cmd/Ctrl+Enter   → newline (inserted manually — textareas don't add one)
 *
 * Pass the controlled value's setter so the Cmd/Ctrl+Enter newline can be
 * spliced in at the caret.
 */
export function composerKeyDown(
  e: KeyboardEvent<HTMLTextAreaElement>,
  send: () => void,
  setValue: (next: string) => void,
): void {
  if (e.key !== 'Enter') return

  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()
    const ta = e.currentTarget
    const start = ta.selectionStart ?? ta.value.length
    const end = ta.selectionEnd ?? ta.value.length
    setValue(ta.value.slice(0, start) + '\n' + ta.value.slice(end))
    requestAnimationFrame(() => {
      try { ta.selectionStart = ta.selectionEnd = start + 1 } catch { /* detached */ }
    })
    return
  }

  if (e.shiftKey) return // default newline
  e.preventDefault()
  send()
}
