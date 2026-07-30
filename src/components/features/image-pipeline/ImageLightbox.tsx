'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { downloadImage } from './download'

interface ImageLightboxProps {
  url: string
  filename: string
  accent: string
  /** Optional caption shown under the image (e.g. the prompt). */
  caption?: string | undefined
  onClose: () => void
}

/**
 * Full-screen image viewer. Tap the backdrop or the ✕ to close; the download
 * button saves the file to disk (with a success/failure toast).
 */
export default function ImageLightbox({ url, filename, accent, caption, onClose }: ImageLightboxProps) {
  const { showToast } = useSettings()
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await downloadImage(url, filename)
      showToast('Image downloaded')
    } catch {
      showToast('Couldn’t download the image. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center p-4"
      >
        {/* Controls */}
        <div className="absolute top-4 right-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 h-11 text-sm font-medium text-white transition-transform active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            <Download size={16} /> {busy ? 'Saving…' : 'Download'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <motion.img
          key="img"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          src={url}
          alt={caption ?? 'Generated image'}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl"
        />
        {caption && (
          <p className="mt-4 max-w-lg text-center text-xs text-white/70 line-clamp-3" onClick={(e) => e.stopPropagation()}>
            {caption}
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
