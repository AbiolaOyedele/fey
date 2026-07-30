'use client'

import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'

interface DropzoneProps {
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  label?: string
  sub?: string
}

/** Fey-styled drag-and-drop / click file picker for the Ruff Tools. */
export default function Dropzone({
  accept = 'image/*',
  multiple = false,
  onFiles,
  label,
  sub,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const arr = [...files].filter((f) => f.type.startsWith('image/'))
    if (arr.length) onFiles(arr)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all select-none
        ${dragging
          ? 'border-[var(--rt-accent)] bg-[var(--rt-accent)]/5'
          : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100/70'
        }`}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} hidden
        onChange={(e) => handleFiles(e.target.files)} />
      <UploadCloud className="mx-auto mb-2 text-gray-300" size={24} />
      <p className="text-xs font-semibold text-gray-500">{label || 'Click or drop image'}</p>
      {sub && <p className="text-2xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
