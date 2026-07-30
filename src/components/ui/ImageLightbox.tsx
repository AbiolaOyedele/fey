'use client'

import { useEffect } from 'react'
import { X, Download, ExternalLink } from 'lucide-react'
import { downloadUrl, formatFileSize } from '@/utils/cloudinary'

interface ImageLightboxProps {
  url: string
  name: string
  /** Bytes — shown next to the name when known. */
  size?: number | null
  onClose: () => void
}

/**
 * Full-screen preview for a single hosted image: backdrop click or Escape to
 * dismiss, with open-in-new-tab and download actions. Used by task attachments
 * and by images embedded inline in a task description.
 */
export default function ImageLightbox({ url, name, size, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    // data-lightbox lets the surrounding modal/drawer skip its own Escape
    // handler while a preview is open, so Escape closes the preview first.
    <div
      data-lightbox=""
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
      // Stop here — the click must not also reach a dismiss-on-outside-click
      // modal sitting behind the preview.
      onMouseDown={(e) => { e.stopPropagation(); onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <div className="relative w-full max-w-3xl max-h-full" onMouseDown={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL; next/image can't size an arbitrary remote asset here. */}
        <img src={url} alt={name} className="max-w-full max-h-[75dvh] mx-auto rounded-2xl object-contain" />
        {/* Dark pill so the caption stays legible whatever sits behind the backdrop. */}
        <div className="flex items-center justify-between gap-3 mt-3 px-3 py-2 rounded-xl bg-black/60 backdrop-blur text-white">
          <span className="text-sm truncate">{name}{size ? ` · ${formatFileSize(size)}` : ''}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              title="Open in new tab"
            >
              <ExternalLink size={16} />
            </a>
            <a
              href={downloadUrl(url)}
              className="w-11 h-11 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              title="Download"
            >
              <Download size={16} />
            </a>
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
