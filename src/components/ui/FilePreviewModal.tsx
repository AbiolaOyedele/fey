'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  Download,
  Check,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  FileText,
  File,
  Loader2,
  History,
  Film,
  Upload,
} from 'lucide-react'
import {
  formatFileSize,
  isImageType,
  isPdfType,
  uploadToCloudinary,
  getFileType,
} from '@/utils/cloudinary'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import type { ClientFile, TaskFile } from '@/types'
import type { FileType } from '@/utils/cloudinary'

// ─── Shared preview type — fields used by this modal from both file kinds ─────

/**
 * Both ClientFile and TaskFile satisfy PreviewableFile. Using this union as the
 * prop type removes the need for `as unknown as TaskFile` at every call site.
 */
export type PreviewableFile = ClientFile | TaskFile

// ─── Status config ────────────────────────────────────────────────────────────

type FileStatus = 'pending' | 'approved' | 'declined' | 'amended'

interface StatusConfig {
  label: string
  cls: string
}

const STATUS_CONFIG: Record<FileStatus, StatusConfig> = {
  pending:  { label: 'Pending',  cls: 'bg-gray-100 text-gray-600' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-600' },
  amended:  { label: 'Amend',    cls: 'bg-amber-100 text-amber-700' },
}

// ─── Extended file type with runtime source tag ───────────────────────────────
// TypeScript does not allow `interface extends UnionType`, so we define a flat
// concrete type that contains every field from both ClientFile and TaskFile.
// Fields that only exist on one variant are typed as optional.

type DisplayFile = {
  // Common fields (present on both ClientFile and TaskFile)
  id: string
  client_id: string | null
  uploaded_by: string | null
  uploader_name: string
  file_name: string
  file_url: string
  public_id: string
  file_size: number
  file_type: FileType         // narrowed from `string` to the typed union
  version: number
  status: 'pending' | 'approved' | 'declined' | 'amended'
  amendment_notes: string | null
  parent_file_id: string | null
  created_at: string
  // Runtime source discriminant (required on ClientFile, absent on TaskFile)
  _source?: 'client' | 'task' | undefined
  // TaskFile-only field
  task_id?: string | undefined
  // ClientFile-only field
  campaign_id?: string | null | undefined
}

// ─── FilePreview sub-component ───────────────────────────────────────────────

interface FilePreviewProps {
  file: DisplayFile
}

function FilePreview({ file }: FilePreviewProps) {
  if (isImageType(file.file_type)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={file.file_url}
        alt={file.file_name}
        className="w-full h-full object-contain rounded-xl"
      />
    )
  }
  if (isPdfType(file.file_type)) {
    return (
      <iframe
        src={file.file_url}
        title={file.file_name}
        className="w-full h-full rounded-xl border-0"
      />
    )
  }
  if (file.file_type === 'video') {
    return (
      <video
        src={file.file_url}
        controls
        className="w-full h-full rounded-xl object-contain bg-black"
      >
        Your browser does not support video playback.
      </video>
    )
  }

  // Generic: document / spreadsheet / other — show download prompt
  const iconMap: Partial<Record<FileType, React.ReactNode>> = {
    document:    <FileText size={52} strokeWidth={1} className="text-blue-300" />,
    spreadsheet: <FileText size={52} strokeWidth={1} className="text-green-300" />,
    video:       <Film     size={52} strokeWidth={1} className="text-purple-300" />,
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
      {iconMap[file.file_type] ?? <File size={52} strokeWidth={1} />}
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">{file.file_name}</p>
        <p className="text-xs text-gray-400 mt-1">{formatFileSize(file.file_size)}</p>
        <p className="text-xs text-gray-300 mt-0.5 capitalize">
          {file.file_type} file — preview not available
        </p>
      </div>
      <a
        href={file.file_url}
        target="_blank"
        rel="noopener noreferrer"
        download={file.file_name}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
      >
        <Download size={14} />
        Download to view
      </a>
    </div>
  )
}

// ─── DeclinePrompt sub-component ─────────────────────────────────────────────

interface DeclinePromptProps {
  onConfirm: (reason: string | null) => void
  onCancel: () => void
}

function DeclinePrompt({ onConfirm, onCancel }: DeclinePromptProps) {
  const [reason, setReason] = useState('')
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-800">Reason for declining (optional)</p>
      <textarea
        autoFocus
        value={reason}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
        rows={3}
        placeholder="Explain what's wrong with this file…"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-gray-400 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(reason || null)}
          className="flex-1 py-2 rounded-xl text-white text-sm font-medium bg-red-500 hover:bg-red-600 transition-colors"
        >
          Decline
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── AmendPrompt sub-component ────────────────────────────────────────────────

interface AmendPromptProps {
  onConfirm: (notes: string) => void
  onCancel: () => void
}

function AmendPrompt({ onConfirm, onCancel }: AmendPromptProps) {
  const [notes, setNotes] = useState('')
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-800">What needs to be amended?</p>
      <textarea
        autoFocus
        value={notes}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
        rows={3}
        placeholder="Describe what changes are needed…"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-gray-400 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(notes)}
          disabled={!notes.trim()}
          className="flex-1 py-2 rounded-xl text-white text-sm font-medium bg-amber-500 hover:bg-amber-600 disabled:opacity-40 transition-colors"
        >
          Request Amend
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type FileSource = 'client' | 'task'
type ActionState = 'decline' | 'amend' | null

interface FilePreviewModalProps {
  /** The file record to preview — accepts either ClientFile or TaskFile */
  file: PreviewableFile
  /** Whether the file belongs to a client or task */
  source: FileSource
  /** Close handler */
  onClose: () => void
  /**
   * Called after a status change.
   * Returns the updated file record or null on failure.
   */
  onStatus: (
    fileId: string,
    source: FileSource,
    status: FileStatus,
    notes?: string | null
  ) => Promise<PreviewableFile | null>
  /**
   * Async fn(fileId, source) returning the version history array.
   * When omitted, the version history section is hidden.
   */
  fetchVersions?: ((fileId: string, source: FileSource) => Promise<PreviewableFile[]>) | undefined
}

/**
 * Full file preview modal with approve/decline/amend actions and version history.
 */
export default function FilePreviewModal({
  file,
  source,
  onClose,
  onStatus,
  fetchVersions,
}: FilePreviewModalProps) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [action, setAction] = useState<ActionState>(null)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [versions, setVersions] = useState<PreviewableFile[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [currentFile, setCurrentFile] = useState<DisplayFile>({
    ...file,
    file_type: file.file_type as FileType,
  })
  const [showUploadVersion, setShowUploadVersion] = useState(false)
  const [versionComment, setVersionComment] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const versionInputRef = useRef<HTMLInputElement>(null)

  // Load version history when toggled
  useEffect(() => {
    if (!showHistory || !fetchVersions) return
    setVersionsLoading(true)
    void fetchVersions(file.id, source).then((vs) => {
      setVersions(vs)
      setVersionsLoading(false)
    })
  }, [showHistory, file.id, source, fetchVersions])

  const handleStatus = async (status: FileStatus, notes: string | null = null) => {
    setSaving(true)
    const updated = await onStatus(file.id, source, status, notes)
    if (updated) {
      setCurrentFile({
        ...currentFile,
        status,
        amendment_notes: notes,
      })
    }
    setSaving(false)
    setAction(null)
  }

  const handleUploadVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0]
    if (!newFile) return
    setUploadProgress(0)
    setUploadError(null)
    // task_id is only on TaskFile; client_id is on both but may be null on TaskFile.
    // We narrow via the source guard which matches what was passed at the call site.
    const folder =
      source === 'task'
        ? `tasks/${(currentFile as TaskFile).task_id}`
        : `clients/${currentFile.client_id ?? 'unknown'}`
    const { promise } = uploadToCloudinary(newFile, folder, setUploadProgress)
    try {
      const { url, publicId, size } = await promise
      const table = source === 'task' ? 'task_files' : 'client_files'
      const rootId = currentFile.parent_file_id ?? currentFile.id
      const newVersion = (currentFile.version ?? 1) + 1
      const payload: Record<string, unknown> = {
        file_name: newFile.name,
        file_url: url,
        public_id: publicId,
        file_size: size || newFile.size,
        file_type: getFileType(newFile.name),
        version: newVersion,
        parent_file_id: rootId,
        status: 'pending',
        uploaded_by: user?.id ?? null,
        uploader_name: settings.username || user?.email || 'You',
        client_id: currentFile.client_id,
        amendment_notes: versionComment.trim() || null,
      }
      if (source === 'task') payload.task_id = (currentFile as TaskFile).task_id
      const { data } = await supabase.from(table).insert(payload).select().single()
      if (data) {
        const typed = data as PreviewableFile
        setCurrentFile({ ...typed, _source: source, file_type: getFileType(typed.file_name) })
        setVersions([])
        setShowHistory(false)
      }
      setShowUploadVersion(false)
      setVersionComment('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setUploadError(msg)
      console.error('[FilePreviewModal] Version upload failed:', err)
    } finally {
      setUploadProgress(null)
    }
  }

  if (!file) return null

  const statusCfg: StatusConfig =
    STATUS_CONFIG[currentFile.status as FileStatus] ?? STATUS_CONFIG.pending

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-sm font-semibold text-gray-900 truncate">
                {currentFile.file_name}
              </h2>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusCfg.cls}`}
              >
                {statusCfg.label}
              </span>
              {currentFile.version > 1 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  v{currentFile.version}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatFileSize(currentFile.file_size)}
              {currentFile.uploader_name && ` · Uploaded by ${currentFile.uploader_name}`}
              {currentFile.created_at &&
                ` · ${new Date(currentFile.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={currentFile.file_url}
              download={currentFile.file_name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={13} />
              Download
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Preview area */}
          <div className="flex-1 p-4 overflow-hidden bg-gray-50">
            <FilePreview file={currentFile} />
          </div>

          {/* Right panel — actions + notes + history */}
          <div className="w-64 border-l border-gray-100 flex flex-col overflow-y-auto flex-shrink-0">
            {/* Amendment notes */}
            {currentFile.amendment_notes && (
              <div className="px-4 pt-4 pb-3">
                <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                  <AlertCircle size={11} /> Amendment notes
                </p>
                <p className="text-xs text-gray-600 bg-amber-50 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
                  {currentFile.amendment_notes}
                </p>
              </div>
            )}

            {/* Status actions */}
            <div className="px-4 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Actions
              </p>

              {action === 'decline' ? (
                <DeclinePrompt
                  onConfirm={(reason) => void handleStatus('declined', reason)}
                  onCancel={() => setAction(null)}
                />
              ) : action === 'amend' ? (
                <AmendPrompt
                  onConfirm={(notes) => void handleStatus('amended', notes)}
                  onCancel={() => setAction(null)}
                />
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => void handleStatus('approved')}
                    disabled={saving || currentFile.status === 'approved'}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Approve
                  </button>
                  <button
                    onClick={() => setAction('decline')}
                    disabled={saving}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                  >
                    <X size={14} />
                    Decline
                  </button>
                  <button
                    onClick={() => setAction('amend')}
                    disabled={saving}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors"
                  >
                    <RotateCcw size={14} />
                    Request Amend
                  </button>
                </div>
              )}
            </div>

            {/* Upload new version */}
            <div className="px-4 py-4 border-b border-gray-100">
              <input
                ref={versionInputRef}
                type="file"
                className="hidden"
                onChange={(e) => void handleUploadVersion(e)}
              />
              {/* Upload error — shown after a failed upload attempt */}
              {uploadError && (
                <div className="flex items-start gap-1.5 mb-2 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {!showUploadVersion ? (
                <button
                  onClick={() => { setShowUploadVersion(true); setUploadError(null) }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  <Upload size={14} />
                  Upload New Version
                </button>
              ) : uploadProgress !== null ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Uploading… {uploadProgress}%</p>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">Add a note (optional)</p>
                  <textarea
                    autoFocus
                    value={versionComment}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setVersionComment(e.target.value)
                    }
                    rows={2}
                    placeholder="What changed in this version?"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 outline-none focus:border-gray-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => versionInputRef.current?.click()}
                      className="flex-1 py-2 rounded-xl text-white text-xs font-medium bg-blue-500 hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload size={12} /> Choose File
                    </button>
                    <button
                      onClick={() => {
                        setShowUploadVersion(false)
                        setVersionComment('')
                        setUploadError(null)
                      }}
                      className="px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Version history */}
            {fetchVersions && (
              <div className="px-4 py-4">
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-full"
                >
                  <History size={12} />
                  Version History
                  <ChevronDown
                    size={12}
                    className={`ml-auto transition-transform ${showHistory ? 'rotate-180' : ''}`}
                  />
                </button>

                {showHistory && (
                  <div className="mt-3 space-y-2">
                    {versionsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 size={11} className="animate-spin" /> Loading…
                      </div>
                    ) : versions.length === 0 ? (
                      <p className="text-xs text-gray-400">Only one version.</p>
                    ) : (
                      versions.map((v) => (
                        <button
                          key={v.id}
                          onClick={() =>
                            setCurrentFile({
                              ...v,
                              _source: source,
                              file_type: v.file_type as FileType,
                            })
                          }
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                            currentFile.id === v.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-700">v{v.version}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full font-medium capitalize ${
                                STATUS_CONFIG[v.status as FileStatus]?.cls ?? ''
                              }`}
                            >
                              {v.status}
                            </span>
                          </div>
                          <p className="text-gray-400 mt-0.5">
                            {new Date(v.created_at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })}
                            {v.uploader_name && ` · ${v.uploader_name}`}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
