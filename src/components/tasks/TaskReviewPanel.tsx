'use client'

import { useCallback, useRef, useState } from 'react'
import {
  Upload, Loader2, Download, Check, RotateCcw, MessageSquare, History, Trash2, Send, X,
  FileText, FileSpreadsheet, FileArchive, File as FileIcon,
} from 'lucide-react'
import { useTaskReview } from '@/hooks/useTaskReview'
import { uploadToCloudinary, getFileType, validateUploadFile, type FileType } from '@/utils/cloudinary'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/utils/relativeTime'
import { MAX_REVIEW_VERSIONS, REVIEW_STATUS_META } from '@/types/task-review'
import type { ReviewDecision, ReviewFile, ReviewFileInput, ReviewVersion } from '@/types/task-review'

interface TaskReviewPanelProps {
  taskId: string
  /** Set when rendered inside a client portal — switches the endpoints used. */
  subdomain?: string | undefined
  /** Viewers read the history but can't upload or rule on it. */
  readOnly?: boolean
}

function fileGlyph(type: FileType, size = 18) {
  if (type === 'pdf' || type === 'document') return <FileText size={size} className="text-rose-400" />
  if (type === 'spreadsheet') return <FileSpreadsheet size={size} className="text-emerald-400" />
  if (type === 'other') return <FileArchive size={size} className="text-amber-400" />
  return <FileIcon size={size} className="text-gray-400" />
}

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * The Review tab: the deliverable itself, versioned.
 *
 * Distinct from Attachments on the Details tab — those are working files that
 * accumulate, this is "the thing that was produced", where each upload replaces
 * the last. Only the current version can be ruled on; older ones stay readable
 * as history, and only three are kept.
 */
export default function TaskReviewPanel({ taskId, subdomain, readOnly = false }: TaskReviewPanelProps) {
  const review = useTaskReview({ taskId, subdomain })
  const [uploading, setUploading] = useState<
    { name: string; pct: number; index: number; total: number } | null
  >(null)
  const [failed, setFailed] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Every file picked becomes ONE version, not one version each — they're
   * parts of a single deliverable, and treating them as separate revisions
   * would burn through the three-version cap on a single multi-select.
   */
  const handleFiles = useCallback(async (list: FileList | null) => {
    const picked = list ? Array.from(list) : []
    if (picked.length === 0) return
    setFailed(null)

    // Validate everything up front: a rejected file halfway through would leave
    // orphaned uploads with no version to attach them to.
    for (const f of picked) {
      const invalid = validateUploadFile(f)
      if (invalid) { setFailed(invalid); return }
    }

    const uploaded: ReviewFileInput[] = []
    try {
      for (let i = 0; i < picked.length; i++) {
        const file = picked[i]
        setUploading({ name: file.name, pct: 0, index: i + 1, total: picked.length })
        const { promise } = uploadToCloudinary(
          file,
          `work-tasks/${taskId}/review`,
          (pct) => setUploading((u) => (u ? { ...u, pct } : u)),
        )
        const { url, publicId, size } = await promise
        uploaded.push({
          file_name: file.name,
          file_url: url,
          public_id: publicId,
          file_size: size || file.size,
          file_type: getFileType(file.name),
        })
      }
      await review.addVersion({ files: uploaded })
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'That upload didn’t finish. Try again.')
    } finally {
      setUploading(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [taskId, review])

  // The draft is what you're preparing; "current" is the deliverable people
  // are actually reviewing, so it's the newest SUBMITTED version.
  const draft = review.versions.find((v) => !v.submitted_at) ?? null
  const current = review.versions.find((v) => v.submitted_at) ?? null

  return (
    <div className="space-y-4">
      {/* Upload */}
      {!readOnly && (
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={!!uploading}
            className="w-full min-h-11 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-xs2 font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {uploading
              ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {uploading.total > 1 && `(${uploading.index}/${uploading.total}) `}
                  <span className="truncate max-w-[14rem]">{uploading.name}</span> · {uploading.pct}%
                </>
              )
              : <><Upload size={15} /> {draft ? 'Add another file' : current ? 'Upload a new version' : 'Upload the finished work'}</>}
          </button>
          <p className="text-3xs text-gray-400 mt-1.5 text-center">
            {draft
              ? 'Check it over, then send it for review. Nothing is shared until you do.'
              : `Pick several files to keep them together as one version. Sending replaces the current one; the last ${MAX_REVIEW_VERSIONS} are kept.`}
          </p>
          {review.lastPruned.length > 0 && (
            <p className="text-3xs text-gray-400 mt-1 text-center">
              Version {review.lastPruned.join(', ')} removed to stay within {MAX_REVIEW_VERSIONS}.
            </p>
          )}
          {failed && <p className="text-xs2 text-red-500 mt-2 text-center">{failed}</p>}
        </div>
      )}

      {/* History */}
      {review.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-40" /><Skeleton className="h-2.5 w-24" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : review.error ? (
        <div className="text-center py-8">
          <p className="text-xs2 text-gray-500 mb-2">{review.error}</p>
          <button onClick={() => void review.refetch()} className="text-xs2 font-semibold" style={{ color: 'var(--accent-text, currentColor)' }}>
            Try again
          </button>
        </div>
      ) : review.versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <History size={26} className="text-gray-200 mb-3" />
          <p className="text-xs2 font-medium text-gray-500">Nothing to review yet</p>
          <p className="text-3xs text-gray-400 mt-0.5">
            {readOnly ? 'The finished work will show up here.' : 'Upload the finished work and it can be reviewed here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {review.versions.map((v) => (
            <VersionCard
              key={v.id}
              version={v}
              isCurrent={v.id === current?.id}
              readOnly={readOnly}
              onComment={(payload) => review.addComment(v.id, payload)}
              onSubmit={() => review.submitVersion(v.id)}
              onDelete={() => review.deleteVersion(v.id)}
              onDeleteFile={(fileId) => review.deleteFile(v.id, fileId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── One version ───────────────────────────────────────────────────────────────

interface VersionCardProps {
  version: ReviewVersion
  isCurrent: boolean
  readOnly: boolean
  onComment: (payload: { body: string; decision?: ReviewDecision | null }) => Promise<void>
  onSubmit: () => Promise<void>
  onDelete: () => Promise<void>
  onDeleteFile: (fileId: string) => Promise<void>
}

function VersionCard({
  version, isCurrent, readOnly, onComment, onSubmit, onDelete, onDeleteFile,
}: VersionCardProps) {
  const isDraft = !version.submitted_at
  const [open, setOpen] = useState(isCurrent)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const status = REVIEW_STATUS_META[version.status]
  // Sent work is part of the record. It only becomes removable once a newer
  // version has replaced it, at which point it's history rather than the
  // deliverable.
  const canDelete = !readOnly && (isDraft || !!version.superseded_at)

  const run = useCallback(async (fn: () => Promise<void>, failure: string) => {
    setBusy(true)
    setErr(null)
    try { await fn() } catch (e) {
      setErr(e instanceof Error ? e.message : failure)
      setBusy(false)
    }
  }, [])

  const send = useCallback(async (decision: ReviewDecision | null) => {
    const body = note.trim()
    // A ruling can stand on its own; a plain note can't.
    if (!body && !decision) return
    setBusy(true)
    setErr(null)
    try {
      await onComment({
        body: body || (decision === 'approved' ? 'Approved.' : 'Changes requested.'),
        decision,
      })
      setNote('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That note didn’t send.')
    } finally {
      setBusy(false)
    }
  }, [note, onComment])

  return (
    <div className={`rounded-xl border ${isCurrent ? 'border-gray-200' : 'border-gray-100 bg-gray-50/40'}`}>
      {/* Version header */}
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs2 font-medium text-gray-800">
              {isDraft ? 'Not sent yet' : `Version ${version.version}`}
            </span>
            <span className="text-3xs text-gray-400 flex-shrink-0">
              {version.files.length} file{version.files.length === 1 ? '' : 's'}
            </span>
            {!isDraft && !isCurrent && <span className="text-3xs text-gray-400 flex-shrink-0">· replaced</span>}
          </div>
          <p className="text-3xs text-gray-400 truncate">
            {version.uploader_name ?? 'Someone'}
            {version.uploader_type === 'client' ? ' (client)' : ''}
            {' · '}{relativeTime(version.created_at)}
          </p>
        </div>
        {isDraft ? (
          <span className="text-3xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-gray-100 text-gray-500">
            Draft
          </span>
        ) : (
          <span
            className="text-3xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: status.bg, color: status.fg }}
          >
            {status.label}
          </span>
        )}
        {canDelete && (
          <button
            onClick={() => void run(onDelete, isDraft ? 'That draft couldn’t be discarded.' : 'That version couldn’t be removed.')}
            disabled={busy}
            title={isDraft ? 'Discard this draft' : 'Remove this version'}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-red-500 flex-shrink-0 disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Files in this version */}
      <div className="px-3 pb-1 space-y-2">
        {version.files.map((f) => (
          <ReviewFileRow
            key={f.id}
            file={f}
            // Only a draft's files can be pulled — once sent, the contents are
            // what people reviewed.
            {...(isDraft && !readOnly
              ? { onRemove: () => run(() => onDeleteFile(f.id), 'That file couldn’t be removed.') }
              : {})}
          />
        ))}
      </div>

      {/* Send for review — the draft's only real action */}
      {isDraft && !readOnly && (
        <div className="px-3 pb-3 pt-1">
          {err && <p className="text-3xs text-red-500 mb-2">{err}</p>}
          <button
            onClick={() => void run(onSubmit, 'That couldn’t be sent for review.')}
            disabled={busy || version.files.length === 0}
            className="w-full min-h-11 flex items-center justify-center gap-1.5 rounded-lg text-xs2 font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send for review
          </button>
          <p className="text-3xs text-gray-400 mt-1.5 text-center">
            Nobody is notified until you send it.
          </p>
        </div>
      )}

      {/* Notes — a draft has nothing to discuss yet */}
      {!isDraft && (
      <div className="px-3 pb-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="min-h-9 flex items-center gap-1.5 text-3xs font-medium text-gray-400 hover:text-gray-600"
        >
          <MessageSquare size={12} />
          {version.comments.length === 0
            ? 'No notes yet'
            : `${version.comments.length} note${version.comments.length === 1 ? '' : 's'}`}
        </button>

        {open && (
          <div className="mt-2 space-y-2">
            {version.comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-white border border-gray-100 p-2.5">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-3xs font-medium text-gray-700">{c.author_name ?? 'Someone'}</span>
                  <span className="text-4xs text-gray-400">{c.author_type === 'client' ? 'Client' : 'Team'}</span>
                  {c.decision && (
                    <span
                      className="text-4xs font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: REVIEW_STATUS_META[c.decision].bg,
                        color: REVIEW_STATUS_META[c.decision].fg,
                      }}
                    >
                      {REVIEW_STATUS_META[c.decision].label}
                    </span>
                  )}
                  <span className="text-4xs text-gray-300 ml-auto">{relativeTime(c.created_at)}</span>
                </div>
                <p className="text-xs2 text-gray-700 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            ))}

            {/* Only the current version can be ruled on — an older one has
                already been replaced, so a verdict on it means nothing. */}
            {!readOnly && isCurrent && (
              <div className="space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note for whoever picks this up…"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs2 outline-none focus:border-gray-400 resize-y"
                />
                {err && <p className="text-3xs text-red-500">{err}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Approve is the primary action here, so it wears the brand
                      accent like every other primary in the app. Request
                      changes is the secondary and stays quiet. */}
                  <button
                    onClick={() => void send('approved')}
                    disabled={busy}
                    className="min-h-9 flex items-center gap-1.5 px-3 rounded-lg text-3xs font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <Check size={13} /> Approve
                  </button>
                  <button
                    onClick={() => void send('changes_requested')}
                    disabled={busy}
                    className="min-h-9 flex items-center gap-1.5 px-3 rounded-lg text-3xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    <RotateCcw size={13} /> Request changes
                  </button>
                  <button
                    onClick={() => void send(null)}
                    disabled={busy || !note.trim()}
                    className="min-h-9 px-3 rounded-lg text-3xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40 ml-auto"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : 'Comment only'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

// ── One file inside a version ─────────────────────────────────────────────────

/**
 * Video and images are shown inline — a deliverable you have to download before
 * you can judge it isn't really reviewable. Everything else gets a row with a
 * download link.
 */
function ReviewFileRow({ file, onRemove }: { file: ReviewFile; onRemove?: (() => void) | undefined }) {
  const type = (file.file_type as FileType) ?? getFileType(file.file_name)
  const remove = onRemove
    ? (
      <button
        onClick={onRemove}
        title="Remove this file"
        className="w-9 h-9 -my-1 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-red-500 flex-shrink-0"
      >
        <X size={14} />
      </button>
    )
    : null

  if (type === 'video') {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-100 bg-black/5">
        <video
          src={file.file_url}
          controls
          preload="metadata"
          className="w-full max-h-64 bg-black"
        />
        <div className="flex items-center gap-2 px-2.5 py-2 bg-white">
          <span className="text-3xs text-gray-600 truncate flex-1 min-w-0">{file.file_name}</span>
          {formatSize(file.file_size) && (
            <span className="text-4xs text-gray-400 flex-shrink-0">{formatSize(file.file_size)}</span>
          )}
          <DownloadLink url={file.file_url} />
          {remove}
        </div>
      </div>
    )
  }

  if (type === 'image') {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.file_url} alt={file.file_name} className="w-full max-h-64 object-contain bg-gray-50" loading="lazy" />
        <div className="flex items-center gap-2 px-2.5 py-2 bg-white">
          <span className="text-3xs text-gray-600 truncate flex-1 min-w-0">{file.file_name}</span>
          {formatSize(file.file_size) && (
            <span className="text-4xs text-gray-400 flex-shrink-0">{formatSize(file.file_size)}</span>
          )}
          <DownloadLink url={file.file_url} />
          {remove}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 px-2.5 py-2">
      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        {fileGlyph(type, 15)}
      </div>
      <span className="text-3xs text-gray-600 truncate flex-1 min-w-0">{file.file_name}</span>
      {formatSize(file.file_size) && (
        <span className="text-4xs text-gray-400 flex-shrink-0">{formatSize(file.file_size)}</span>
      )}
      <DownloadLink url={file.file_url} />
      {remove}
    </div>
  )
}

function DownloadLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Download"
      className="w-9 h-9 -my-1 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0"
    >
      <Download size={14} />
    </a>
  )
}
