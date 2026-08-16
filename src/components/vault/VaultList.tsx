'use client'

import { useState } from 'react'
import {
  FileText, Receipt, FileSignature, Image as ImageIcon, Film, Download,
  Trash2, Loader2, Users, Lock, Building2, ExternalLink, StickyNote,
} from 'lucide-react'
import { formatFileSize } from '@/utils/cloudinary'
import { taskProgress } from '@/utils/note-markdown'
import {
  VAULT_CATEGORY_LABEL, isEditable,
  type VaultEntry, type VaultVisibility,
} from '@/types/vault'

/**
 * The Vault's list, shared by the agency and the client portal.
 *
 * `canManage` is what separates the two: the agency gets rename, reshare and
 * delete on uploaded files; a client gets a read-only list. The visibility chip
 * is agency-only too — a client seeing "shared with all clients" on a document
 * tells them about an arrangement that isn't theirs to know.
 *
 * Rows rather than cards. A vault is a list you scan for one known thing, and
 * cards spread ten documents over three screens of phone.
 */

interface VaultListProps {
  entries: VaultEntry[]
  loading: boolean
  error?: string | null
  accent: string
  /** Agency side. Enables the per-file controls. */
  canManage?: boolean
  onDelete?: (entry: VaultEntry) => Promise<void>
  onReshare?: (entry: VaultEntry) => void
  /** Opens a note in place. Notes have nothing to link to. */
  onOpen?: ((entry: VaultEntry) => void) | undefined
  /** Shown when nothing matches, or nothing exists yet. */
  emptyMessage?: string | undefined
}

function iconFor(entry: VaultEntry) {
  if (entry.kind === 'invoice') return Receipt
  if (entry.kind === 'contract') return FileSignature
  if (entry.kind === 'note') return StickyNote
  if (entry.resource_type === 'image') return ImageIcon
  if (entry.resource_type === 'video') return Film
  return FileText
}

const VISIBILITY_ICON: Record<VaultVisibility, typeof Lock> = {
  private:     Lock,
  client:      Building2,
  all_clients: Users,
}

const VISIBILITY_SHORT: Record<VaultVisibility, string> = {
  private:     'Team only',
  client:      'Shared',
  all_clients: 'All clients',
}

export default function VaultList({
  entries, loading, error, accent, canManage = false, onDelete, onReshare, onOpen, emptyMessage,
}: VaultListProps) {
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [confirmId, setConfirm] = useState<string | null>(null)

  const remove = async (entry: VaultEntry) => {
    if (!onDelete) return
    setBusyId(entry.id)
    try {
      await onDelete(entry)
      setConfirm(null)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-[68px] bg-gray-50 animate-pulse ${i > 0 ? 'border-t border-gray-50' : ''}`} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
        {error}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
        <div className="w-11 h-11 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-3">
          <FileText size={18} />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">Nothing here yet</p>
        <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
          {emptyMessage ?? 'Invoices and contracts appear here on their own. Notes you write and files you upload sit alongside them.'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      {entries.map((entry, i) => {
        const Icon = iconFor(entry)
        const busy = busyId === entry.id
        const editable = canManage && isEditable(entry)
        const VisibilityIcon = entry.visibility ? VISIBILITY_ICON[entry.visibility] : null
        // A note has no URL — the whole title block opens it in place instead.
        const openable = entry.kind === 'note' && !!onOpen
        const tasks = entry.kind === 'note' && entry.body ? taskProgress(entry.body) : null

        return (
          <div
            key={`${entry.kind}-${entry.id}`}
            // flex-wrap so the delete confirmation can drop onto its own full
            // width row instead of squeezing the title on a phone.
            className={`flex flex-wrap items-center gap-3 px-3 sm:px-4 py-3 min-h-[68px] ${i > 0 ? 'border-t border-gray-50' : ''}`}
          >
            <span
              aria-hidden
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accent}12`, color: accent }}
            >
              <Icon size={16} />
            </span>

            {/* A button only when there's something to open in place, so a
                plain row keeps its normal text selection and cursor. */}
            {(() => {
              const meta = (
                <>
                  <span className="block text-sm font-medium text-gray-800 truncate group-hover:text-gray-950 transition-colors">
                    {entry.title}
                  </span>
                  {/* Everything secondary on one wrapping line, so a long client
                      name pushes down rather than clipping. */}
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-gray-400">
                    <span>{VAULT_CATEGORY_LABEL[entry.category]}</span>
                    {entry.contact_name && <span className="truncate max-w-[140px]">· {entry.contact_name}</span>}
                    {tasks && tasks.total > 0 && <span>· {tasks.done}/{tasks.total} done</span>}
                    {entry.subtitle && <span className="truncate max-w-[200px]">· {entry.subtitle}</span>}
                    {entry.file_size != null && <span>· {formatFileSize(entry.file_size)}</span>}
                    {canManage && VisibilityIcon && entry.visibility && (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        · <VisibilityIcon size={10} /> {VISIBILITY_SHORT[entry.visibility]}
                      </span>
                    )}
                  </span>
                </>
              )

              return openable ? (
                <button
                  onClick={() => onOpen(entry)}
                  aria-label={`Open ${entry.title}`}
                  className="group min-w-0 flex-1 text-left py-1 -my-1 rounded-lg"
                >
                  {meta}
                </button>
              ) : (
                <div className="min-w-0 flex-1">{meta}</div>
              )
            })()}

            <div className="flex items-center gap-0.5 flex-shrink-0">
              {entry.href && (
                <a
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={entry.kind === 'file' ? `Download ${entry.title}` : `Open ${entry.title}`}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {entry.kind === 'file' ? <Download size={15} /> : <ExternalLink size={15} />}
                </a>
              )}

              {editable && onReshare && (
                <button
                  onClick={() => onReshare(entry)}
                  aria-label={`Change who can see ${entry.title}`}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Users size={15} />
                </button>
              )}

              {editable && onDelete && (
                <button
                  onClick={() => setConfirm(confirmId === entry.id ? null : entry.id)}
                  aria-label={`Delete ${entry.title}`}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-gray-50 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            {confirmId === entry.id && (
              <div className="w-full basis-full flex flex-wrap items-center gap-2 pt-2 mt-2 border-t border-gray-50">
                <span className="text-2xs text-gray-500 flex-1 min-w-[160px]">
                  {entry.kind === 'note'
                    ? `Delete “${entry.title}”? This can’t be undone.`
                    : `Delete “${entry.title}”? The file is removed too, and this can’t be undone.`}
                </span>
                <button
                  onClick={() => setConfirm(null)}
                  className="px-3 py-2 min-h-[40px] rounded-full text-2xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void remove(entry)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-2xs font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: 'var(--danger)' }}
                >
                  {busy && <Loader2 size={11} className="animate-spin" />}
                  Delete
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
