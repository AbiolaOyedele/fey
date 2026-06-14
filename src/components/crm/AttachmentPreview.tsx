'use client'

import { FileText, FileSpreadsheet, FileArchive, File as FileIcon, Download } from 'lucide-react'
import { formatFileSize } from '@/utils/cloudinary'
import type { MessageAttachment } from '@/types/crm'

function isImage(att: MessageAttachment): boolean {
  if (att.file_type?.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|svg|bmp|heic)$/i.test(att.file_name)
}

function fileGlyph(att: MessageAttachment) {
  const t = att.file_type ?? ''
  const name = att.file_name.toLowerCase()
  if (t.includes('pdf') || name.endsWith('.pdf') || /\.(docx?|txt|rtf)$/.test(name)) {
    return <FileText size={18} className="text-rose-400" />
  }
  if (t.includes('sheet') || /\.(xlsx?|csv)$/.test(name)) {
    return <FileSpreadsheet size={18} className="text-emerald-400" />
  }
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) {
    return <FileArchive size={18} className="text-amber-400" />
  }
  return <FileIcon size={18} className="text-gray-400" />
}

interface AttachmentPreviewProps {
  attachments: MessageAttachment[]
  /** Tightens the bubble look — own/owner messages sit on an accent background. */
  onAccent?: boolean
}

/**
 * Renders message attachments inline, chat-app style: images show a tappable
 * thumbnail, other files show a compact chip with a type icon, name and size.
 * Shared by the client message thread and the internal Playground.
 */
export default function AttachmentPreview({ attachments, onAccent = false }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      {attachments.map((att, i) =>
        isImage(att) ? (
          <a key={i} href={att.file_url} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={att.file_url}
              alt={att.file_name}
              className="rounded-xl max-w-[220px] max-h-[220px] w-auto h-auto object-cover border border-black/5"
            />
          </a>
        ) : (
          <a
            key={i}
            href={att.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 max-w-[240px] transition-colors ${
              onAccent ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-50 hover:bg-gray-100 border border-gray-100'
            }`}
          >
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${onAccent ? 'bg-white/30' : 'bg-white border border-gray-100'}`}>
              {fileGlyph(att)}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-xs font-medium truncate ${onAccent ? 'text-white' : 'text-gray-800'}`}>{att.file_name}</span>
              <span className={`block text-3xs ${onAccent ? 'text-white/70' : 'text-gray-400'}`}>{formatFileSize(att.file_size)}</span>
            </span>
            <Download size={14} className={`flex-shrink-0 ${onAccent ? 'text-white/70' : 'text-gray-300 group-hover:text-gray-500'}`} />
          </a>
        ),
      )}
    </div>
  )
}
