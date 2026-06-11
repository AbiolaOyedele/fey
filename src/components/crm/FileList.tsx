'use client'

import { useRef, useState } from 'react'
import {
  Upload, Download, Trash2, FileText, File, Image, Music, Film,
  X, ExternalLink, LayoutGrid, List,
} from 'lucide-react'
import { useViewMode } from '@/hooks/useViewMode'
import type { CrmFile } from '@/types/crm'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileCategory(type: string | null): 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'other' {
  if (!type) return 'other'
  if (type.startsWith('image/'))                             return 'image'
  if (type.startsWith('video/'))                             return 'video'
  if (type.startsWith('audio/'))                             return 'audio'
  if (type === 'application/pdf')                            return 'pdf'
  if (type.includes('document') || type.includes('msword')) return 'doc'
  return 'other'
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1048576)     return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function cloudinaryThumb(url: string, w = 120, h = 120): string {
  return url.replace('/upload/', `/upload/w_${w},h_${h},c_fill,q_auto,f_auto/`)
}

// ── Colour maps ───────────────────────────────────────────────────────────────

const ICON_MAP = { image: Image, video: Film, audio: Music, pdf: FileText, doc: FileText, other: File } as const
const BG_MAP   = { image: 'bg-blue-50', video: 'bg-purple-50', audio: 'bg-yellow-50', pdf: 'bg-red-50', doc: 'bg-emerald-50', other: 'bg-gray-100' } as const
const CLR_MAP  = { image: 'text-blue-400', video: 'text-purple-400', audio: 'text-yellow-500', pdf: 'text-red-400', doc: 'text-emerald-500', other: 'text-gray-400' } as const

// ── FileThumbnail (list row) ──────────────────────────────────────────────────

function FileThumbnail({ file, onClick }: { file: CrmFile; onClick: () => void }) {
  const cat  = fileCategory(file.file_type)
  const Icon = ICON_MAP[cat]

  if (cat === 'image') {
    return (
      <button onClick={onClick} className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 hover:opacity-90 transition-opacity focus:outline-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cloudinaryThumb(file.file_url)} alt={file.file_name} className="w-full h-full object-cover" loading="lazy" />
      </button>
    )
  }

  return (
    <button onClick={onClick} className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${BG_MAP[cat]} hover:opacity-80 transition-opacity focus:outline-none`}>
      <Icon size={18} className={CLR_MAP[cat]} />
    </button>
  )
}

// ── GridCard ─────────────────────────────────────────────────────────────────

function GridCard({ file, isOwn, onPreview, onDelete }: { file: CrmFile; isOwn: boolean; onPreview: () => void; onDelete: () => void }) {
  const cat  = fileCategory(file.file_type)
  const Icon = ICON_MAP[cat]

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer" onClick={onPreview}>
      {/* Preview area */}
      <div className={`h-28 flex items-center justify-center ${cat === 'image' ? '' : BG_MAP[cat]}`}>
        {cat === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cloudinaryThumb(file.file_url, 280, 112)}
            alt={file.file_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon size={32} className={CLR_MAP[cat]} />
        )}
      </div>

      {/* Hover overlay actions */}
      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={file.file_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-7 h-7 rounded-lg bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          title="Open"
        >
          <ExternalLink size={12} />
        </a>
        {isOwn && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="w-7 h-7 rounded-lg bg-red-500/60 hover:bg-red-500/80 flex items-center justify-center text-white transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Caption */}
      <div className="p-3">
        <p className="text-[13px] font-medium text-gray-900 truncate leading-snug">{file.file_name}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
          <span className={`inline-block text-[9px] font-bold uppercase px-1 py-0.5 rounded ${BG_MAP[cat]} ${CLR_MAP[cat]}`}>
            {cat === 'other' ? (file.file_type?.split('/')[1] ?? 'file') : cat}
          </span>
          {formatBytes(file.file_size)}
        </p>
      </div>
    </div>
  )
}

// ── ViewToggle ────────────────────────────────────────────────────────────────

function ViewToggle({ mode, onChange }: { mode: 'list' | 'grid'; onChange: (m: 'list' | 'grid') => void }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
      <button
        onClick={() => onChange('list')}
        title="List view"
        className={`p-1.5 rounded-md transition-colors ${mode === 'list' ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <List size={14} />
      </button>
      <button
        onClick={() => onChange('grid')}
        title="Grid view"
        className={`p-1.5 rounded-md transition-colors ${mode === 'grid' ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <LayoutGrid size={14} />
      </button>
    </div>
  )
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({ file, isOwn, onClose, onDelete }: { file: CrmFile; isOwn: boolean; onClose: () => void; onDelete: () => void }) {
  const cat = fileCategory(file.file_type)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-3 px-1" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{file.file_name}</p>
          <p className="text-xs text-white/50">{formatBytes(file.file_size)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
            <ExternalLink size={13} /> Open original
          </a>
          <a href={file.file_url} download={file.file_name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
            <Download size={13} /> Download
          </a>
          {isOwn && (
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs font-medium transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="w-full max-w-4xl flex-1 flex items-center justify-center overflow-hidden rounded-2xl" style={{ maxHeight: 'calc(100vh - 120px)' }} onClick={(e) => e.stopPropagation()}>
        {cat === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.file_url} alt={file.file_name} className="max-w-full max-h-full object-contain rounded-2xl" />
        )}
        {cat === 'video' && (
          <video src={file.file_url} controls autoPlay className="max-w-full max-h-full rounded-2xl" />
        )}
        {cat === 'audio' && (
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-yellow-50 flex items-center justify-center"><Music size={28} className="text-yellow-500" /></div>
            <p className="text-sm font-medium text-gray-700 text-center">{file.file_name}</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={file.file_url} controls autoPlay className="w-72" />
          </div>
        )}
        {cat === 'pdf' && (
          <iframe src={`${file.file_url}#toolbar=0`} title={file.file_name} className="w-full rounded-2xl bg-white" style={{ height: 'calc(100vh - 140px)' }} />
        )}
        {(cat === 'doc' || cat === 'other') && (
          <div className="bg-white rounded-2xl p-10 flex flex-col items-center gap-4 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${BG_MAP[cat]}`}>
              {(() => { const Icon = ICON_MAP[cat]; return <Icon size={28} className={CLR_MAP[cat]} /> })()}
            </div>
            <p className="text-sm font-semibold text-gray-800">{file.file_name}</p>
            <p className="text-xs text-gray-400">{formatBytes(file.file_size)}</p>
            <a href={file.file_url} download={file.file_name} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--accent, #ED64A6)' }}>
              <Download size={14} /> Download file
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ── FileList ──────────────────────────────────────────────────────────────────

interface FileListProps {
  files:      CrmFile[]
  loading:    boolean
  ownerId:    string
  contactId:  string
  onUpload:   (file: File) => Promise<void>
  onDelete:   (id: string) => Promise<void>
  uploading?: boolean
}

export default function FileList({ files, loading, ownerId, onUpload, onDelete, uploading = false }: FileListProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<CrmFile | null>(null)
  const [mode, setMode] = useViewMode('files', 'list')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await onUpload(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = async (fileId: string) => {
    setPreview(null)
    await onDelete(fileId)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Files</h2>
          <p className="text-sm text-gray-400">
            {loading ? '…' : `${files.length} file${files.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle mode={mode} onChange={setMode} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            <Upload size={14} />
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => void handleFileChange(e)} />
      </div>

      {/* Loading */}
      {loading ? (
        mode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-48 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        )
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText size={32} className="text-gray-200 mb-3" />
          <p className="text-[15px] font-medium text-gray-500 mb-1">No files yet</p>
          <p className="text-[13px] text-gray-400">Upload files to share with this client.</p>
        </div>

      /* ── Grid view ── */
      ) : mode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map((file) => (
            <GridCard
              key={file.id}
              file={file}
              isOwn={file.uploaded_by === ownerId}
              onPreview={() => setPreview(file)}
              onDelete={() => void handleDelete(file.id)}
            />
          ))}
        </div>

      /* ── List view ── */
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {files.map((file) => {
            const isOwn = file.uploaded_by === ownerId
            const cat   = fileCategory(file.file_type)
            return (
              <div key={file.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 transition-colors group">
                <FileThumbnail file={file} onClick={() => setPreview(file)} />
                <button onClick={() => setPreview(file)} className="flex-1 min-w-0 text-left">
                  <p className="text-[14px] font-medium text-gray-900 truncate">{file.file_name}</p>
                  <p className="text-[12px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md ${BG_MAP[cat]} ${CLR_MAP[cat]}`}>
                      {cat === 'other' ? (file.file_type?.split('/')[1] ?? 'file') : cat}
                    </span>
                    {formatBytes(file.file_size)}
                    <span className="text-gray-300">·</span>
                    {file.uploader_type === 'owner' ? 'You' : 'Client'}
                    <span className="text-gray-300">·</span>
                    {new Date(file.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Download">
                    <Download size={14} />
                  </a>
                  {isOwn && (
                    <button onClick={() => void handleDelete(file.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <PreviewModal
          file={preview}
          isOwn={preview.uploaded_by === ownerId}
          onClose={() => setPreview(null)}
          onDelete={() => void handleDelete(preview.id)}
        />
      )}
    </div>
  )
}
