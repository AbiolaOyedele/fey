import { env } from '@/config/env'
import {
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_EXTENSIONS,
  BLOCKED_UPLOAD_EXTENSIONS,
} from '@/lib/constants'

const CLOUD_NAME = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

interface UploadResult {
  url: string
  publicId: string
  size: number
  format: string
}

interface UploadHandle {
  promise: Promise<UploadResult>
  abort: () => void
}

const extOf = (name: string): string => name.split('.').pop()?.toLowerCase() ?? ''

const humanSize = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`

/**
 * Validates a file against Fey's upload policy (size + extension allow/block
 * lists). Returns a plain-English error string, or null when the file is
 * acceptable. Call before uploading; the uploader enforces it too.
 */
export function validateUploadFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is larger than ${humanSize(MAX_UPLOAD_BYTES)}.`
  }
  const ext = extOf(file.name)
  if (!ext) return `"${file.name}" has no file extension and can’t be uploaded.`
  if ((BLOCKED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    return `"${file.name}" is a type we don’t allow for safety reasons.`
  }
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    return `"${file.name}" isn’t a supported file type.`
  }
  return null
}

export const uploadToCloudinary = (
  file: File,
  folder: string,
  onProgress?: (pct: number) => void
): UploadHandle => {
  let xhr: XMLHttpRequest

  const promise = new Promise<UploadResult>((resolve, reject) => {
    const validationError = validateUploadFile(file)
    if (validationError) {
      reject(new Error(validationError))
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', UPLOAD_PRESET ?? '')
    formData.append('folder', `fey/${folder}`)

    xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`)

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText) as { secure_url: string; public_id: string; bytes: number; format: string }
        resolve({ url: data.secure_url, publicId: data.public_id, size: data.bytes, format: data.format })
      } else {
        let msg = `Upload failed (${xhr.status})`
        try {
          const err = JSON.parse(xhr.responseText) as { error?: { message?: string } }
          if (err?.error?.message) msg = err.error.message
        } catch { /* ignore parse error */ }
        reject(new Error(msg))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('cancelled'))
    xhr.send(formData)
  })

  return { promise, abort: () => xhr?.abort() }
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'heic']
const PDF_EXTS   = ['pdf']
const DOC_EXTS   = ['doc', 'docx', 'txt', 'rtf', 'odt', 'pages']
const SHEET_EXTS = ['xls', 'xlsx', 'csv', 'numbers']
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm', 'mkv']

export type FileType = 'image' | 'pdf' | 'document' | 'spreadsheet' | 'video' | 'other'

export const getFileType = (fileName = ''): FileType => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (PDF_EXTS.includes(ext))   return 'pdf'
  if (DOC_EXTS.includes(ext))   return 'document'
  if (SHEET_EXTS.includes(ext)) return 'spreadsheet'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  return 'other'
}

export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const isImageType = (fileType: FileType): boolean => fileType === 'image'
export const isPdfType   = (fileType: FileType): boolean => fileType === 'pdf'
