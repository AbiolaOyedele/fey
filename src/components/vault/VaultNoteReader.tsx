'use client'

import { useEffect, useState } from 'react'
import { X, Pencil, StickyNote } from 'lucide-react'
import NoteBody from '@/components/vault/NoteBody'
import { relativeTime } from '@/utils/relativeTime'
import { toggleTask, taskProgress } from '@/utils/note-markdown'
import { VAULT_CATEGORY_LABEL, type VaultEntry } from '@/types/vault'

/**
 * An open note.
 *
 * Reading is the default because that's what most opens are for — finding the
 * one line you wrote down last month. Editing is a deliberate step away from
 * it, which also means a note can't be changed by a stray tap while someone is
 * scrolling through it on a phone.
 *
 * Ticking a checkbox is the exception, and the one thing that works without
 * entering edit mode. It applies straight away and saves behind the scenes: a
 * checklist you have to open an editor for is a checklist nobody keeps up to
 * date. If the save fails the tick goes back and says so.
 */

interface VaultNoteReaderProps {
  entry: VaultEntry
  accent: string
  /** Agency side. Enables ticking and the edit button. */
  canManage?: boolean
  /** Persists a new body. Only called when `canManage`. */
  onSaveBody?: (body: string) => Promise<void>
  onEdit?: () => void
  onClose: () => void
}

export default function VaultNoteReader({
  entry, accent, canManage = false, onSaveBody, onEdit, onClose,
}: VaultNoteReaderProps) {
  /**
   * Held locally so a tick lands instantly rather than after a round trip.
   *
   * Seeded once, on purpose. Callers mount this with `key={note.id}`, so
   * opening a different note gets fresh state anyway — and not re-syncing from
   * the prop means a slow save for the first tick can't land after a second one
   * and briefly undo it. While the note is open, this copy is the truth.
   */
  const [body, setBody]   = useState(entry.body ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tick = (line: number) => {
    if (!canManage || !onSaveBody) return
    const previous = body
    const next = toggleTask(previous, line)
    if (next === previous) return

    setBody(next)
    setError('')
    void onSaveBody(next).catch(() => {
      setBody(previous)
      setError('That change couldn’t be saved. Please try again.')
    })
  }

  const progress = taskProgress(body)
  const edited = entry.updated_at ?? entry.created_at

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 animate-fadeIn">
      <div className="flex items-start gap-3 mb-3">
        <span
          aria-hidden
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accent}12`, color: accent }}
        >
          <StickyNote size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base text-gray-900 break-words">{entry.title}</h2>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-gray-400 mt-0.5">
            <span>{VAULT_CATEGORY_LABEL[entry.category]}</span>
            {entry.contact_name && <span className="truncate max-w-[160px]">· {entry.contact_name}</span>}
            <span>· Edited {relativeTime(edited)}</span>
            {progress.total > 0 && (
              <span>· {progress.done} of {progress.total} done</span>
            )}
          </div>
        </div>

        <div className="flex items-center flex-shrink-0 -mr-1">
          {canManage && onEdit && (
            <button
              onClick={onEdit}
              aria-label={`Edit ${entry.title}`}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={15} />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close note"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {progress.total > 0 && (
        <div className="h-1 rounded-full bg-gray-100 overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{ width: `${(progress.done / progress.total) * 100}%`, backgroundColor: accent }}
          />
        </div>
      )}

      {error && (
        <p className="text-2xs mb-2" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      <NoteBody
        body={body}
        accent={accent}
        onToggleTask={canManage && onSaveBody ? tick : undefined}
        emptyMessage={canManage ? 'Nothing written yet. Tap edit to start.' : 'This note is empty.'}
      />
    </div>
  )
}
