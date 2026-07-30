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
 * Uploads raw bytes to Cloudinary from the server, signed with the api_secret.
 * Used for assets the browser never sees — AI-generated images arrive as bytes
 * in the API route, so the client-signed upload flow doesn't apply.
 *
 * `folder` is a subpath under the shared `fey/` root; the public_id is derived
 * server-side and never from a user-supplied filename.
 */
export async function uploadCloudinaryAsset(
  bytes: Buffer,
  input: { folder: string; publicId: string; mimeType?: string },
): Promise<{ url: string; publicId: string; bytes: number } | null> {
  const cloud     = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey    = env.CLOUDINARY_API_KEY
  const apiSecret = env.CLOUDINARY_API_SECRET
  if (!cloud || !apiKey || !apiSecret) return null

  const folder = `fey/${input.folder.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '')}`
  const publicId = input.publicId.replace(/[^a-zA-Z0-9_-]/g, '')
  const timestamp = Math.floor(Date.now() / 1000)

  // Signed params, alpha-sorted, excluding file/api_key/resource_type/signature.
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex')

  try {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(bytes)], { type: input.mimeType ?? 'image/png' }))
    form.append('api_key', apiKey)
    form.append('timestamp', String(timestamp))
    form.append('signature', signature)
    form.append('folder', folder)
    form.append('public_id', publicId)

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      console.error('[uploadCloudinaryAsset] upload failed', { status: res.status })
      return null
    }
    const data = (await res.json()) as { secure_url?: string; public_id?: string; bytes?: number }
    if (!data.secure_url || !data.public_id) return null
    return { url: data.secure_url, publicId: data.public_id, bytes: data.bytes ?? bytes.byteLength }
  } catch (err) {
    console.error('[uploadCloudinaryAsset] upload errored', { name: (err as Error)?.name })
    return null
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
