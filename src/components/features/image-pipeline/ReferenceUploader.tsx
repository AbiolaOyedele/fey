'use client'

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ImagePlus, X, Plus, Loader2, AlertCircle } from 'lucide-react'
import { MAX_REFERENCE_IMAGES } from '@/types/image-pipeline'
import { uploadToCloudinary } from '@/utils/cloudinary'

/**
 * A reference image, uploaded to Cloudinary via the app's signed-upload flow.
 * `previewUrl` is a local object URL for the thumbnail; `url`/`public_id` are the
 * Cloudinary values the server needs (populated once the upload finishes).
 */
export interface ReferenceAsset {
  id: string
  file: File
  previewUrl: string
  status: 'uploading' | 'done' | 'error'
  url: string | null
  public_id: string | null
  error?: string
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024
/** Reference images live under their own Cloudinary folder. */
const UPLOAD_FOLDER = 'image-pipeline/references'

interface ReferenceUploaderProps {
  assets: ReferenceAsset[]
  /** The parent's state setter — lets async upload callbacks update safely. */
  setAssets: Dispatch<SetStateAction<ReferenceAsset[]>>
  accent: string
}

/**
 * Multi-image reference picker (up to MAX_REFERENCE_IMAGES). Each file is
 * validated (jpeg/png/webp, ≤10MB) and uploaded to Cloudinary through the
 * server-signed flow; the server then re-checks it. Mobile-first: a responsive
 * thumbnail grid with 44px+ tap targets and a per-image upload state.
 */
export default function ReferenceUploader({ assets, setAssets, accent }: ReferenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Abort handles for in-flight uploads, so removing a thumbnail cancels it.
  const aborts = useRef<Map<string, () => void>>(new Map())

  const remaining = MAX_REFERENCE_IMAGES - assets.length

  const startUpload = useCallback(
    (asset: ReferenceAsset) => {
      const handle = uploadToCloudinary(asset.file, UPLOAD_FOLDER)
      aborts.current.set(asset.id, handle.abort)
      handle.promise
        .then((res) => {
          aborts.current.delete(asset.id)
          setAssets((prev) =>
            prev.map((a) => (a.id === asset.id ? { ...a, status: 'done', url: res.url, public_id: res.publicId } : a)),
          )
        })
        .catch((err: unknown) => {
          aborts.current.delete(asset.id)
          if (err instanceof Error && err.message === 'cancelled') return
          setAssets((prev) =>
            prev.map((a) =>
              a.id === asset.id ? { ...a, status: 'error', error: 'Upload failed — remove and try again.' } : a,
            ),
          )
        })
    },
    [setAssets],
  )

  const addFiles = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (!files) return
      const list = Array.from(files)
      if (list.length === 0) return

      const accepted: ReferenceAsset[] = []
      let rejected: string | null = null
      for (const file of list) {
        if (accepted.length >= remaining) {
          rejected = `You can add up to ${MAX_REFERENCE_IMAGES} reference images.`
          break
        }
        if (!ALLOWED.includes(file.type)) {
          rejected = 'Please choose JPEG, PNG or WebP images.'
          continue
        }
        if (file.size > MAX_BYTES) {
          rejected = 'Each image must be under 10MB.'
          continue
        }
        accepted.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
          url: null,
          public_id: null,
        })
      }

      setError(rejected)
      if (accepted.length > 0) {
        setAssets((prev) => [...prev, ...accepted])
        accepted.forEach(startUpload)
      }
    },
    [remaining, setAssets, startUpload],
  )

  const removeById = useCallback(
    (id: string) => {
      const target = assets.find((a) => a.id === id)
      if (target) {
        aborts.current.get(id)?.()
        aborts.current.delete(id)
        URL.revokeObjectURL(target.previewUrl)
      }
      setAssets((prev) => prev.filter((a) => a.id !== id))
      setError(null)
    },
    [assets, setAssets],
  )

  const openPicker = () => inputRef.current?.click()

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ALLOWED.join(',')}
      multiple
      className="hidden"
      onChange={(e) => {
        addFiles(e.target.files)
        e.target.value = '' // allow re-picking the same file
      }}
    />
  )

  // Empty state — the big drop zone.
  if (assets.length === 0) {
    return (
      <div>
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
          className={`w-full rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${
            dragging ? 'bg-gray-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          style={dragging ? { borderColor: accent } : undefined}
        >
          <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${accent}15`, color: accent }}>
            <ImagePlus size={22} />
          </span>
          <span className="text-sm font-medium text-gray-700">Drop reference images, or tap to browse</span>
          <span className="text-2xs text-gray-400 mt-1">JPEG, PNG or WebP · up to 10MB each · max {MAX_REFERENCE_IMAGES}</span>
        </button>
        {fileInput}
        {error && <p className="text-xs mt-2" style={{ color: '#E53E3E' }}>{error}</p>}
      </div>
    )
  }

  // Populated state — a thumbnail grid with a trailing "add more" tile.
  return (
    <div>
      <div
        className="grid grid-cols-3 sm:grid-cols-4 gap-2"
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
      >
        {assets.map((asset, index) => (
          <div key={asset.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={asset.previewUrl} alt={`Reference ${index + 1}`} className="w-full h-full object-cover" />

            {asset.status === 'uploading' && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                <Loader2 size={18} className="animate-spin" />
              </span>
            )}
            {asset.status === 'error' && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-white text-center px-1">
                <AlertCircle size={16} />
                <span className="text-3xs leading-tight">Failed</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => removeById(asset.id)}
              aria-label={`Remove reference image ${index + 1}`}
              className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-black/55 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X size={14} />
            </button>
            {index === 0 && asset.status === 'done' && (
              <span className="absolute bottom-1 left-1 text-3xs font-semibold text-white bg-black/55 rounded px-1.5 py-0.5">Main</span>
            )}
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={openPicker}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
            aria-label="Add more reference images"
          >
            <Plus size={20} />
            <span className="text-3xs mt-1">Add</span>
          </button>
        )}
      </div>
      <p className="text-2xs text-gray-400 mt-1.5">
        {assets.length} of {MAX_REFERENCE_IMAGES} · the first image is treated as the main subject.
      </p>
      {fileInput}
      {error && <p className="text-xs mt-2" style={{ color: '#E53E3E' }}>{error}</p>}
    </div>
  )
}
