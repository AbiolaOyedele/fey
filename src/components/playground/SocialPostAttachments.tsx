'use client'

import { useRef, useState, useCallback } from 'react'
import { Upload, Trash2, Loader2, X, Download, FileText, FileSpreadsheet, FileArchive, File as FileIcon, ExternalLink } from 'lucide-react'
import {
  uploadToCloudinary, getFileType, formatFileSize, isImageType,
  downloadUrl, thumbUrl, type FileType,
} from '@/utils/cloudinary'
import type { SocialPostFile } from '@/types/social'

function fileGlyph(fileType: FileType, size = 18) {
  if (fileType === 'pdf' || fileType === 'document') return <FileText size={size} className="text-rose-400" />
  if (fileType === 'spreadsheet') return <FileSpreadsheet size={size} className="text-emerald-400" />
  if (fileType === 'other') return <FileArchive size={size} className="text-amber-400" />
  return <FileIcon size={size} className="text-gray-400" />
}

interface UploadItem {
  id: string
  name: string
  progress: number
}

interface SocialPostAttachmentsProps {
  postId: string
  files: SocialPostFile[]
  onAdd: (postId: string, payload: { file_name: string; file_url: string; public_id: string; file_size?: number | null; file_type?: string | null }) => Promise<unknown>
  onRemove: (postId: string, fileId: string) => Promise<void>
}

/** Inspiration image/file uploads for a post — drag-drop/browse upload direct
 *  to Cloudinary via the signed flow, thumbnail grid, image lightbox with
 *  download, per-file delete. Mirrors TaskAttachments on the social_posts model. */
export default function SocialPostAttachments({ postId, files, onAdd, onRemove }: SocialPostAttachmentsProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [preview, setPreview] = useState<SocialPostFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortsRef = useRef<Record<string, () => void>>({})

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return
    setFailed(null)
    for (const file of Array.from(fileList)) {
      const uid = crypto.randomUUID()
      setUploads((p) => [...p, { id: uid, name: file.name, progress: 0 }])
      const { promise, abort } = uploadToCloudinary(
        file,
        `social-posts/${postId}`,
        (pct) => setUploads((p) => p.map((u) => (u.id === uid ? { ...u, progress: pct } : u))),
      )
      abortsRef.current[uid] = abort
      try {
        const { url, publicId, size } = await promise
        await onAdd(postId, {
          file_name: file.name,
          file_url: url,
          public_id: publicId,
          file_size: size || file.size,
          file_type: getFileType(file.name),
        })
      } catch (err) {
        if (err instanceof Error && err.message !== 'cancelled') setFailed(err.message)
      } finally {
        delete abortsRef.current[uid]
        setUploads((p) => p.filter((u) => u.id !== uid))
      }
    }
  }, [postId, onAdd])

  const openFile = useCallback((f: SocialPostFile) => {
    if (isImageType((f.file_type as FileType) ?? getFileType(f.file_name))) setPreview(f)
    else window.open(f.file_url, '_blank', 'noopener,noreferrer')
  }, [])

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files) }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition-colors ${
          dragOver ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <Upload size={14} className="text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-500">
          Drop images or files, or{' '}
          <span className="font-medium" style={{ color: 'var(--accent, #ED64A6)' }}>browse</span>
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { void handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {failed && <p className="mt-2 text-xs text-red-500">{failed}</p>}

      {uploads.map((u) => (
        <div key={u.id} className="flex items-center gap-2 mt-2 px-1">
          <Loader2 size={12} className="animate-spin text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-600 flex-1 truncate">{u.name}</span>
          <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
            <div className="h-full rounded-full transition-[width]" style={{ width: `${u.progress}%`, backgroundColor: 'var(--accent, #ED64A6)' }} />
          </div>
          <button onClick={() => abortsRef.current[u.id]?.()} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="Cancel upload">
            <X size={12} />
          </button>
        </div>
      ))}

      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {files.map((f) => {
            const type = (f.file_type as FileType) ?? getFileType(f.file_name)
            return (
              <div key={f.id} className="group relative">
                <button
                  onClick={() => openFile(f)}
                  title={f.file_name}
                  className="w-full aspect-square rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex flex-col items-center justify-center gap-1 hover:border-gray-200 transition-colors"
                >
                  {isImageType(type) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl(f.file_url)} alt={f.file_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <>
                      {fileGlyph(type)}
                      <span className="text-4xs text-gray-400 px-1 truncate max-w-full">{f.file_name}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => void onRemove(postId, f.id)}
                  title={`Delete ${f.file_name}`}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow border border-gray-100 flex items-center justify-center text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.file_url} alt={preview.file_name} className="max-w-full max-h-[80vh] rounded-2xl object-contain" />
            <div className="flex items-center justify-between gap-3 mt-3 text-white">
              <span className="text-sm truncate">{preview.file_name}{preview.file_size ? ` · ${formatFileSize(preview.file_size)}` : ''}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={preview.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                </a>
                <a
                  href={downloadUrl(preview.file_url)}
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                  title="Download"
                >
                  <Download size={14} />
                </a>
                <button
                  onClick={() => setPreview(null)}
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
