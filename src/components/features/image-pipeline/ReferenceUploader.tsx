'use client'

import { useCallback, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

export interface ReferenceAsset {
  /** Cloudinary public_id in Batch 2; a mock id here. */
  public_id: string
  url: string
  file: File
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

interface ReferenceUploaderProps {
  asset: ReferenceAsset | null
  onSelect: (asset: ReferenceAsset | null) => void
  accent: string
}

/**
 * Reference-image picker. Validates MIME (jpeg/png/webp) and size (≤10MB) up
 * front — the same rules the server re-checks in Batch 2. For the mock phase the
 * file becomes a local object URL; Batch 2 swaps this for the existing
 * client-signed Cloudinary upload (uploadToCloudinary).
 */
export default function ReferenceUploader({ asset, onSelect, accent }: ReferenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return
      if (!ALLOWED.includes(file.type)) {
        setError('Please choose a JPEG, PNG or WebP image.')
        return
      }
      if (file.size > MAX_BYTES) {
        setError('That image is larger than 10MB.')
        return
      }
      setError(null)
      onSelect({ public_id: `mock/reference/${file.name}`, url: URL.createObjectURL(file), file })
    },
    [onSelect],
  )

  const clear = useCallback(() => {
    if (asset) URL.revokeObjectURL(asset.url)
    onSelect(null)
    setError(null)
  }, [asset, onSelect])

  if (asset) {
    return (
      <div className="relative rounded-2xl border border-gray-100 bg-white p-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL / Cloudinary asset */}
          <img src={asset.url} alt="Reference" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{asset.file.name}</p>
            <p className="text-2xs text-gray-400">{(asset.file.size / (1024 * 1024)).toFixed(1)} MB · reference image</p>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove reference image"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]) }}
        className={`w-full rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${
          dragging ? 'bg-gray-50' : 'border-gray-200 hover:border-gray-300'
        }`}
        style={dragging ? { borderColor: accent } : undefined}
      >
        <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${accent}15`, color: accent }}>
          <ImagePlus size={22} />
        </span>
        <span className="text-sm font-medium text-gray-700">Drop a reference image, or tap to browse</span>
        <span className="text-2xs text-gray-400 mt-1">JPEG, PNG or WebP · up to 10MB</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(',')}
        className="hidden"
        onChange={(e) => accept(e.target.files?.[0])}
      />
      {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
    </div>
  )
}
