'use client'

import { useState } from 'react'
import { Download, Maximize2, Sparkles, RotateCcw } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import type { IpGeneration } from '@/types/image-pipeline'
import StatusPill from './StatusPill'
import ExpiryCountdown from './ExpiryCountdown'
import ImageLightbox from './ImageLightbox'
import { assetFilename, downloadImage } from './download'
import { fmtDateTime } from './format'

/**
 * A single gallery item. Tap the image to enlarge; the download button saves the
 * file to disk. Rejected previews are retained (they auto-delete on expiry like
 * any image), so they still show and remain downloadable.
 */
export default function GenerationTile({
  generation,
  accent,
  onRetry,
}: {
  generation: IpGeneration
  accent: string
  onRetry?: (id: string) => Promise<{ ok: boolean; message: string }>
}) {
  const { showToast } = useSettings()
  const [lightbox, setLightbox] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const retry = async () => {
    if (!onRetry) return
    setRetrying(true)
    const result = await onRetry(generation.id)
    setRetrying(false)
    showToast(result.message)
  }

  const image = generation.final_url ?? generation.preview_url ?? generation.source_image_urls[0] ?? null
  const downloadable = generation.final_url ?? generation.preview_url
  const kind: 'final' | 'preview' = generation.final_url ? 'final' : 'preview'
  const caption = generation.final_prompt ?? generation.generated_prompt ?? generation.user_prompt ?? generation.user_notes ?? undefined

  const save = async () => {
    if (!downloadable) return
    setBusy(true)
    try {
      await downloadImage(downloadable, assetFilename(generation.id, kind))
      showToast('Image downloaded')
    } catch {
      showToast('Couldn’t download the image. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="group rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-square bg-gray-50">
        {image ? (
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="block w-full h-full cursor-zoom-in"
            aria-label="View larger"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary/mock asset */}
            <img src={image} alt={caption ?? 'Generated image'} className="w-full h-full object-cover" loading="lazy" />
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            <span className="absolute bottom-2 left-2 w-8 h-8 rounded-lg bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 size={14} />
            </span>
          </button>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-gray-300">
            <Sparkles size={22} />
            <span className="text-2xs">No image yet</span>
          </div>
        )}

        <div className="absolute top-2 left-2 pointer-events-none">
          <StatusPill status={generation.status} accent={accent} />
        </div>
        <span
          className="absolute top-2 right-2 text-3xs font-semibold uppercase tracking-wide text-white px-1.5 py-0.5 rounded pointer-events-none"
          style={{ backgroundColor: `${accent}cc` }}
        >
          {generation.tier}
        </span>
        {downloadable && (
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all active:scale-95 disabled:opacity-60"
            aria-label="Download image"
          >
            <Download size={16} />
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-gray-600 line-clamp-2 min-h-[2rem]">
          {caption ?? 'Untitled generation'}
        </p>
        {generation.status === 'failed' && generation.error_message && (
          <p className="text-2xs mt-1 line-clamp-2" style={{ color: '#E53E3E' }}>{generation.error_message}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-3xs text-gray-400">{fmtDateTime(generation.created_at)}</span>
          <ExpiryCountdown expiresAt={generation.expires_at} />
        </div>
        {generation.status === 'failed' && onRetry && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg h-9 text-xs font-medium text-white transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: `var(--accent-fill, ${accent})` }}
          >
            <RotateCcw size={13} className={retrying ? 'animate-spin' : ''} /> {retrying ? 'Retrying…' : 'Retry generation'}
          </button>
        )}
      </div>

      {lightbox && image && (
        <ImageLightbox
          url={downloadable ?? image}
          filename={assetFilename(generation.id, kind)}
          caption={caption}
          accent={accent}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  )
}
