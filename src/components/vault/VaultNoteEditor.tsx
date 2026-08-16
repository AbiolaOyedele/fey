'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  X, Loader2, Heading2, List, CheckSquare, Quote, Eye, PenLine,
} from 'lucide-react'
import NoteBody from '@/components/vault/NoteBody'
import {
  VAULT_CATEGORIES, VAULT_CATEGORY_LABEL,
  VAULT_VISIBILITIES, VAULT_VISIBILITY_LABEL, VAULT_VISIBILITY_DESCRIPTION,
  type VaultCategory, type VaultVisibility,
} from '@/types/vault'

/**
 * Writing a note.
 *
 * Plain text with a handful of Markdown markers, not a rich-text editor. A
 * textarea keeps every phone keyboard, every paste, and every accessibility
 * affordance working exactly as the platform intends — a contenteditable
 * surface would have to re-earn all three, and the notes an agency writes are
 * a paragraph and a checklist, not a layout.
 *
 * The toolbar and the Enter handling are what make that bearable on a phone:
 * lists continue themselves, and the markers can be tapped rather than typed.
 */

export interface NoteDraft {
  title:      string
  body:       string
  category:   VaultCategory
  visibility: VaultVisibility
  contact_id: string | null
}

interface VaultNoteEditorProps {
  accent: string
  clients: { id: string; name: string }[]
  /** Absent when writing a new note. */
  initial?: NoteDraft | undefined
  onSave: (draft: NoteDraft) => Promise<void>
  onCancel: () => void
}

const EMPTY: NoteDraft = {
  title: '', body: '', category: 'other', visibility: 'private', contact_id: null,
}

/** The markers the toolbar and the Enter key both understand. */
const MARKER = /^(\s*)([-*]\s\[[ xX]\]\s|[-*]\s|#{1,3}\s|>\s|\d{1,3}[.)]\s)?/

const TOOLS: { key: string; label: string; prefix: string; Icon: typeof List }[] = [
  { key: 'task',    label: 'Checklist item', prefix: '- [ ] ', Icon: CheckSquare },
  { key: 'bullet',  label: 'Bullet',         prefix: '- ',     Icon: List },
  { key: 'heading', label: 'Heading',        prefix: '## ',    Icon: Heading2 },
  { key: 'quote',   label: 'Quote',          prefix: '> ',     Icon: Quote },
]

export default function VaultNoteEditor({
  accent, clients, initial, onSave, onCancel,
}: VaultNoteEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  /** Where the caret should land after a programmatic edit. */
  const caretRef = useRef<number | null>(null)

  const [draft, setDraft]     = useState<NoteDraft>(initial ?? EMPTY)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const set = <K extends keyof NoteDraft>(key: K, value: NoteDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  // Restore the caret after any edit we made ourselves, before paint, so the
  // cursor never visibly jumps to the end of the note.
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el || caretRef.current === null) return
    el.setSelectionRange(caretRef.current, caretRef.current)
    caretRef.current = null
  }, [draft.body])

  // Escape closes, as it does everywhere else in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const write = (body: string, caret: number) => {
    caretRef.current = caret
    set('body', body)
    bodyRef.current?.focus()
  }

  /** Adds a marker to the current line, or removes it if it's already there. */
  const applyPrefix = (prefix: string) => {
    const el = bodyRef.current
    if (!el) return

    const value     = el.value
    const caret     = el.selectionStart
    const lineStart = value.lastIndexOf('\n', caret - 1) + 1
    const lineEnd   = value.indexOf('\n', caret) === -1 ? value.length : value.indexOf('\n', caret)
    const line      = value.slice(lineStart, lineEnd)

    const [, indent = '', existing = ''] = MARKER.exec(line) ?? []
    const rest = line.slice(indent.length + existing.length)
    // Tapping the same marker twice takes it off again — otherwise the only way
    // to undo a mis-tap is to hunt for the characters with a thumb.
    const next = existing === prefix ? `${indent}${rest}` : `${indent}${prefix}${rest}`

    write(
      value.slice(0, lineStart) + next + value.slice(lineEnd),
      lineStart + next.length - rest.length + Math.max(0, caret - lineStart - indent.length - existing.length),
    )
  }

  /**
   * Enter inside a list continues it; Enter on an empty list item ends it.
   * The behaviour every notes app has, and the reason a checklist can be typed
   * straight through without reaching for the toolbar between lines.
   */
  const onBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return

    const el        = e.currentTarget
    const value     = el.value
    const caret     = el.selectionStart
    if (caret !== el.selectionEnd) return

    const lineStart = value.lastIndexOf('\n', caret - 1) + 1
    const line      = value.slice(lineStart, caret)

    const list = /^(\s*)([-*]\s\[[ xX]\]\s|[-*]\s|(\d{1,3})[.)]\s)/.exec(line)
    if (!list) return

    const [, indent = '', marker = '', , number] = list
    const rest = line.slice(indent.length + marker.length)

    e.preventDefault()

    if (!rest.trim()) {
      // An empty item means "I'm done with this list".
      write(value.slice(0, lineStart) + value.slice(caret), lineStart)
      return
    }

    const next = number !== undefined
      ? `${indent}${Number(number) + 1}. `
      // A continued checkbox always starts unticked, whatever the one above it was.
      : `${indent}${marker.replace(/\[[xX]\]/, '[ ]')}`

    write(
      `${value.slice(0, caret)}\n${next}${value.slice(caret)}`,
      caret + 1 + next.length,
    )
  }

  const save = async () => {
    if (!draft.title.trim()) { setError('Give this note a name.'); return }
    if (draft.visibility === 'client' && !draft.contact_id) {
      setError('Choose which client should see this.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ ...draft, title: draft.title.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That note couldn’t be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xs font-semibold uppercase tracking-widest text-gray-300">
          {initial ? 'Edit note' : 'Write a note'}
        </span>
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-300 hover:text-gray-500"
        >
          <X size={15} />
        </button>
      </div>

      <input
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
        placeholder="Note title"
        aria-label="Note title"
        autoFocus={!initial}
        className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
      />

      {/* Formatting — scrolls sideways rather than wrapping onto a second row
          and pushing the writing area down the screen. */}
      <div className="flex items-center gap-1 mt-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        {TOOLS.map(({ key, label, prefix, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPrefix(prefix)}
            disabled={preview}
            aria-label={label}
            title={label}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            <Icon size={15} />
          </button>
        ))}
        <span aria-hidden className="w-px h-5 bg-gray-100 mx-1 flex-shrink-0" />
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 h-11 rounded-xl text-2xs font-medium transition-colors"
          style={preview
            ? { backgroundColor: `${accent}12`, color: accent }
            : { color: '#9CA3AF' }}
        >
          {preview ? <PenLine size={13} /> : <Eye size={13} />}
          {preview ? 'Write' : 'Preview'}
        </button>
      </div>

      {preview ? (
        <div className="mt-1 px-3 py-3 min-h-[180px] rounded-xl border border-gray-100 bg-gray-50/50">
          <NoteBody body={draft.body} accent={accent} emptyMessage="Nothing to preview yet." />
        </div>
      ) : (
        <textarea
          ref={bodyRef}
          value={draft.body}
          onChange={(e) => set('body', e.target.value)}
          onKeyDown={onBodyKeyDown}
          placeholder={'Start typing.\n\n## Headings, - bullets, - [ ] checkboxes\n**Emphasis**, `code`, and links all work.'}
          aria-label="Note"
          rows={10}
          className="w-full mt-1 px-3 py-3 min-h-[180px] rounded-xl border border-gray-200 bg-gray-50 text-sm leading-relaxed outline-none focus:border-gray-400 focus:bg-white transition-colors resize-y"
        />
      )}

      <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 pt-3 pb-2">Category</span>
      <div className="flex flex-wrap gap-1.5">
        {VAULT_CATEGORIES.map((c) => {
          const active = draft.category === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => set('category', c)}
              className="px-3 min-h-[44px] rounded-xl text-xs font-medium border transition-colors"
              style={active
                ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
                : { borderColor: '#E5E7EB', color: '#6B7280' }}
            >
              {VAULT_CATEGORY_LABEL[c]}
            </button>
          )
        })}
      </div>

      <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 pt-3 pb-2">
        Who can see it
      </span>
      <div className="flex flex-wrap gap-1.5">
        {VAULT_VISIBILITIES.map((v) => {
          const active = draft.visibility === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                set('visibility', v)
                if (v !== 'client') set('contact_id', null)
              }}
              className="px-3 min-h-[44px] rounded-xl text-xs font-medium border transition-colors"
              style={active
                ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
                : { borderColor: '#E5E7EB', color: '#6B7280' }}
            >
              {VAULT_VISIBILITY_LABEL[v]}
            </button>
          )
        })}
      </div>
      <p className="text-2xs text-gray-400 leading-relaxed mt-2">
        {VAULT_VISIBILITY_DESCRIPTION[draft.visibility]}
      </p>

      {draft.visibility === 'client' && (
        <select
          value={draft.contact_id ?? ''}
          onChange={(e) => set('contact_id', e.target.value || null)}
          aria-label="Which client"
          className="w-full mt-2 px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
        >
          <option value="">Choose a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {error && <p className="text-2xs mt-3" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-3 py-2.5 min-h-[44px] rounded-full text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={() => void save()}
          disabled={!draft.title.trim() || saving}
          className="press inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-white text-xs font-semibold disabled:opacity-40"
          style={{ backgroundColor: accent }}
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {initial ? 'Save changes' : 'Save to Vault'}
        </button>
      </div>
    </div>
  )
}
