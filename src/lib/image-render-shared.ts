import { AppError } from '@/lib/errors'

/**
 * Pieces every image render engine needs, kept in one place so the Gemini and
 * OpenAI clients can't drift on the parts that must behave identically:
 * how a reference image is fetched and capped, what the model is told about
 * those references, and which failures count as worth retrying.
 *
 * Server-only — provider keys never reach the browser.
 */

export type RenderSize = '1K' | '2K'

export interface RenderedImage {
  /** Raw image bytes, ready for a server-side Cloudinary upload. */
  data: Buffer
  mimeType: string
}

export interface RenderImageInput {
  /** Provider model id, validated against IMAGE_MODELS before it gets here. */
  model: string
  prompt: string
  /**
   * Cloudinary URLs of the reference images to send with the prompt. Empty when
   * the run has no references OR when the user chose to render from the prompt
   * alone — the caller decides, this only renders what it is given.
   */
  sourceImageUrls: string[]
  size: RenderSize
}

export const RENDER_TIMEOUT_MS = 120_000

/** Reference images are capped before upload so we don't ship a 4000px original. */
const REFERENCE_WIDTH = 1024
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024

export interface FetchedReference {
  mimeType: string
  bytes: Buffer
}

/** Downloads a Cloudinary reference image, capped, for inline/multipart send. */
export async function fetchReference(url: string): Promise<FetchedReference> {
  const capped = url.replace(/\/upload\//, `/upload/w_${REFERENCE_WIDTH},c_limit,q_auto/`)
  const res = await fetch(capped, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    throw new AppError(502, 'Couldn’t read the reference image. Please try again.', 'IP_REFERENCE_FETCH_FAILED')
  }
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.byteLength > MAX_REFERENCE_BYTES) {
    throw new AppError(400, 'That reference image is too large. Use one under 10 MB.', 'IP_REFERENCE_TOO_LARGE')
  }
  const mimeType = res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
  return { mimeType, bytes }
}

/** True for the transient statuses worth another attempt. */
export const isRetryable = (status: number): boolean => status === 429 || status >= 500

/** Marks a failure the retry loop should try again, carrying any Retry-After. */
export function transientError(message: string, retryAfterMs?: number): AppError {
  return new AppError(502, message, 'IP_RENDER_TRANSIENT', retryAfterMs ? { retryAfterMs } : undefined)
}

/** Reads a Retry-After header (seconds) into milliseconds, if present and sane. */
export function retryAfterHeaderMs(headers: Headers): number | undefined {
  const value = headers.get('retry-after')
  if (!value || !Number.isFinite(Number(value))) return undefined
  return Number(value) * 1000
}

/**
 * Sent as the last instruction whenever reference images are attached.
 *
 * Without it a model treats the references as things to reproduce, so anything
 * baked into the source — lettering, a watermark, a logo, background clutter —
 * reappears in the output even though the prompt never asked for it (the prompt
 * step routinely leaves such things out on purpose). This makes the split
 * explicit: the images supply likeness and style, the prompt decides what is
 * actually in the frame.
 */
export const REFERENCE_DIRECTIVE = `The provided image(s) are VISUAL REFERENCE ONLY. Use them for subject likeness, style, colour and composition.

The written prompt is authoritative and complete. Render exactly what it describes — nothing more.

Do not carry over any text, lettering, captions, watermarks, logos, labels, badges, UI elements, borders, frames, or background objects from the reference images unless the prompt explicitly asks for them. If something appears in a reference but is not described in the prompt, leave it out of the generated image.`
