import crypto from 'crypto'
import { env } from '@/config/env'

/**
 * Parses a Cloudinary delivery URL into the resource type + public_id needed by
 * the Admin destroy API.
 *
 *   https://res.cloudinary.com/<cloud>/image/upload/v123/fey/messages/abc.png
 *     → { resourceType: 'image', publicId: 'fey/messages/abc' }
 */
export function parseCloudinaryUrl(url: string): { resourceType: string; publicId: string } | null {
  const m = url.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/)
  if (!m?.[1] || !m[2]) return null
  const resourceType = m[1]
  let publicId = m[2]
  // image/video public_ids exclude the file extension; raw public_ids KEEP it.
  if (resourceType !== 'raw') {
    const lastDot = publicId.lastIndexOf('.')
    const lastSlash = publicId.lastIndexOf('/')
    if (lastDot > lastSlash) publicId = publicId.slice(0, lastDot)
  }
  return { resourceType, publicId }
}

/**
 * Deletes a single Cloudinary asset by its exact public_id + resource type.
 * Best-effort: returns false (never throws) if creds are missing or the call
 * fails — metadata rows are the source of truth, CDN cleanup never blocks.
 */
export async function destroyCloudinaryAssetById(publicId: string, resourceType: string): Promise<boolean> {
  const cloud     = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey    = env.CLOUDINARY_API_KEY
  const apiSecret = env.CLOUDINARY_API_SECRET
  if (!cloud || !apiKey || !apiSecret) return false

  try {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = crypto
      .createHash('sha1')
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex')

    const body = new URLSearchParams({
      public_id: publicId,
      api_key:   apiKey,
      timestamp: String(timestamp),
      signature,
    })

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/destroy`,
      { method: 'POST', body },
    )
    if (!res.ok) return false
    const data = await res.json() as { result?: string }
    return data.result === 'ok' || data.result === 'not found'
  } catch {
    return false
  }
}

/**
 * Deletes a single Cloudinary asset by its delivery URL. Best-effort: returns
 * false (never throws) if creds are missing or the call fails, so a retention
 * sweep is never blocked by storage cleanup.
 */
export async function destroyCloudinaryAsset(url: string): Promise<boolean> {
  const parsed = parseCloudinaryUrl(url)
  if (!parsed) return false
  return destroyCloudinaryAssetById(parsed.publicId, parsed.resourceType)
}
