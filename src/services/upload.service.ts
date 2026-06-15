import crypto from 'crypto'
import { env } from '@/config/env'
import { AppError } from '@/lib/errors'

/**
 * Builds a short-lived Cloudinary upload signature so the browser can upload
 * directly to Cloudinary WITHOUT the account being open to the world. The
 * preset is in "Signed" mode, so every upload must carry these signed params
 * (api_key + timestamp + signature + the exact params that were signed).
 *
 * The api_secret never leaves the server.
 */

export interface UploadSignature {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
  uploadPreset?: string
}

/**
 * Signs an upload into `fey/<folder>`. `rawFolder` is sanitised to a safe
 * subpath so a caller can't escape the `fey/` namespace.
 */
export function buildUploadSignature(rawFolder: unknown): UploadSignature {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = env.CLOUDINARY_API_KEY
  const apiSecret = env.CLOUDINARY_API_SECRET
  const uploadPreset = env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(500, 'File uploads aren’t set up right now.', 'UPLOAD_NOT_CONFIGURED')
  }

  const safe = (typeof rawFolder === 'string' ? rawFolder : '')
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .replace(/^\/+|\/+$/g, '')
    .slice(0, 100) || 'misc'
  const folder = `fey/${safe}`
  const timestamp = Math.floor(Date.now() / 1000)

  // Params that will be sent to Cloudinary AND must be signed (alpha-sorted,
  // excluding file/api_key/cloud_name/resource_type/signature).
  const params: Record<string, string | number> = { folder, timestamp }
  if (uploadPreset) params.upload_preset = uploadPreset

  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')

  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    ...(uploadPreset ? { uploadPreset } : {}),
  }
}
