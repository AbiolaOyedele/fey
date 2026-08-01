import { env } from '@/config/env'
import { AppError } from '@/lib/errors'
import { MAX_REFERENCE_IMAGES, type ImageTier } from '@/types/image-pipeline'

/**
 * Gemini (Nano Banana) client for the Image Pipeline's render steps.
 *
 * Standard tier renders with gemini-2.5-flash-image ("Nano Banana"), pro with
 * gemini-3-pro-image ("Nano Banana Pro"). Preview renders at 1K, the approved
 * final at 2K — the size hint is only honoured by the pro model, so on the
 * standard tier both steps come back at the model's native resolution (which
 * is why the seeded rates price them identically).
 *
 * Raw fetch rather than an SDK: this is one endpoint, and it keeps the
 * dependency list to the confirmed stack. The key is server-only.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const IMAGE_MODEL: Record<ImageTier, string> = {
  standard: 'gemini-2.5-flash-image',
  pro: 'gemini-3-pro-image',
}

const TIMEOUT_MS = 120_000
/** Reference images are capped before upload so we don't ship a 4000px original. */
const REFERENCE_WIDTH = 1024
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024

export type RenderSize = '1K' | '2K'

export interface RenderedImage {
  /** Raw image bytes, ready for a server-side Cloudinary upload. */
  data: Buffer
  mimeType: string
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  inline_data?: { mime_type: string; data: string }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

function requireKey(): string {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, 'Image generation isn’t set up yet.', 'IP_GEMINI_NOT_CONFIGURED')
  }
  return env.GEMINI_API_KEY
}

/** Downloads the Cloudinary reference image so it can be sent inline. */
async function fetchReference(url: string): Promise<{ mimeType: string; base64: string }> {
  const capped = url.replace(/\/upload\//, `/upload/w_${REFERENCE_WIDTH},c_limit,q_auto/`)
  const res = await fetch(capped, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    throw new AppError(502, 'Couldn’t read the reference image. Please try again.', 'IP_REFERENCE_FETCH_FAILED')
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.byteLength > MAX_REFERENCE_BYTES) {
    throw new AppError(400, 'That reference image is too large. Use one under 10 MB.', 'IP_REFERENCE_TOO_LARGE')
  }
  const mimeType = res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
  return { mimeType, base64: buffer.toString('base64') }
}

/** True for the transient statuses worth one retry. */
const isRetryable = (status: number): boolean => status === 429 || status >= 500

/**
 * Sent as the last part whenever reference images are attached.
 *
 * Without it the model treats the references as things to reproduce, so
 * anything baked into the source — lettering, a watermark, a logo, background
 * clutter — reappears in the output even though the prompt never asked for it
 * (the prompt step routinely leaves such things out on purpose). This makes the
 * split explicit: the images supply likeness and style, the prompt decides what
 * is actually in the frame. It goes last so it is the final instruction the
 * model reads.
 */
const REFERENCE_DIRECTIVE = `The preceding image(s) are VISUAL REFERENCE ONLY. Use them for subject likeness, style, colour and composition.

The written prompt above is authoritative and complete. Render exactly what it describes — nothing more.

Do not carry over any text, lettering, captions, watermarks, logos, labels, badges, UI elements, borders, frames, or background objects from the reference images unless the prompt explicitly asks for them. If something appears in a reference but is not described in the prompt, leave it out of the generated image.`

export interface RenderImageInput {
  tier: ImageTier
  prompt: string
  /**
   * Cloudinary URLs of the reference images to send with the prompt. Empty when
   * the run has no references OR when the user chose to render from the prompt
   * alone — the caller decides, this only renders what it is given.
   */
  sourceImageUrls: string[]
  size: RenderSize
}

/**
 * Renders one image. Throws an AppError with a plain-English message on
 * failure — the caller marks the run failed and refunds the step.
 */
export async function renderImage(input: RenderImageInput): Promise<RenderedImage> {
  const key = requireKey()
  const model = IMAGE_MODEL[input.tier]

  const parts: GeminiPart[] = [{ text: input.prompt }]
  // Inline each reference image (capped). Fetched sequentially to keep peak
  // memory bounded — these are up to 10MB each.
  const references = input.sourceImageUrls.slice(0, MAX_REFERENCE_IMAGES)
  for (const url of references) {
    const reference = await fetchReference(url)
    parts.push({ inlineData: { mimeType: reference.mimeType, data: reference.base64 } })
  }
  // Only meaningful when there's actually a reference to constrain.
  if (references.length > 0) parts.push({ text: REFERENCE_DIRECTIVE })

  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      // Only the pro model honours an explicit size; sending it to the flash
      // model is ignored, so it's scoped to avoid a surprise 400.
      ...(input.tier === 'pro' ? { imageConfig: { imageSize: input.size } } : {}),
    },
  })

  // Image generation is slow (~20s) and the API rate-limits bursts, so transient
  // 429/5xx are common. Retry a few times with growing backoff, honouring any
  // Retry-After the API sends, before giving up.
  const BACKOFFS_MS = [0, 2000, 5000, 9000]
  let lastError: AppError | null = null
  for (let attempt = 0; attempt < BACKOFFS_MS.length; attempt++) {
    if (attempt > 0) {
      const hinted = retryAfterMsOf(lastError)
      await new Promise((resolve) => setTimeout(resolve, hinted ?? BACKOFFS_MS[attempt] ?? 9000))
    }
    try {
      return await callGemini(model, key, body)
    } catch (err) {
      if (!(err instanceof AppError)) throw err
      // Only transient failures are worth another attempt.
      if (err.code !== 'IP_RENDER_TRANSIENT') throw err
      lastError = err
    }
  }
  throw lastError ?? new AppError(502, 'Couldn’t generate that image. Please try again.', 'IP_RENDER_FAILED')
}

/** Pulls a Retry-After hint (ms) off a transient error, if the API sent one. */
function retryAfterMsOf(err: AppError | null): number | null {
  const details = err?.details
  if (details && typeof details === 'object' && 'retryAfterMs' in details) {
    const value = (details as { retryAfterMs: unknown }).retryAfterMs
    if (typeof value === 'number' && value > 0) return Math.min(value, 30_000)
  }
  return null
}

async function callGemini(model: string, key: string, body: string): Promise<RenderedImage> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    // Network error or timeout — worth one retry.
    console.error('[renderImage] fetch failed', { model, name: (err as Error)?.name, message: (err as Error)?.message })
    throw new AppError(504, 'Image generation timed out. Please try again.', 'IP_RENDER_TRANSIENT')
  }

  if (!res.ok) {
    // The error body is the API's own error description (status/message), not a
    // prompt echo, so it's safe — and useful — to log. Success bodies are the
    // ones we never log.
    const rawError = await res.text().catch(() => '')
    let providerStatus: string | undefined
    let providerMessage: string | undefined
    try {
      const parsed = JSON.parse(rawError) as GeminiResponse
      providerStatus = parsed.error?.status
      providerMessage = parsed.error?.message
    } catch {
      providerMessage = rawError.slice(0, 300) || undefined
    }
    console.error('[renderImage] provider error', {
      model,
      httpStatus: res.status,
      providerStatus,
      providerMessage,
    })
    // A free-tier / zero-quota exhaustion is a configuration problem, not a
    // transient blip — retrying can't fix a hard `limit: 0`, so fail fast with an
    // actionable message instead of burning the retry budget.
    const quotaExhausted =
      res.status === 429 &&
      (providerStatus === 'RESOURCE_EXHAUSTED' || /quota|billing|free_tier|limit:\s*0/i.test(providerMessage ?? ''))
    if (quotaExhausted && /free_tier|billing|limit:\s*0/i.test(providerMessage ?? '')) {
      throw new AppError(
        402,
        'Image generation is out of quota. The image API key needs billing enabled to generate images.',
        'IP_RENDER_QUOTA_EXHAUSTED',
      )
    }
    if (isRetryable(res.status)) {
      const retryAfter = res.headers.get('retry-after')
      const retryAfterMs = retryAfter && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : undefined
      throw new AppError(
        502,
        'Image generation is busy right now. Please try again.',
        'IP_RENDER_TRANSIENT',
        retryAfterMs ? { retryAfterMs } : undefined,
      )
    }
    if (res.status === 401 || res.status === 403) {
      throw new AppError(503, 'Image generation isn’t set up correctly.', 'IP_GEMINI_NOT_CONFIGURED')
    }
    if (res.status === 404) {
      throw new AppError(502, 'The image model isn’t available. Please try again or contact support.', 'IP_RENDER_MODEL_NOT_FOUND')
    }
    throw new AppError(502, 'Couldn’t generate that image. Please try again.', 'IP_RENDER_FAILED')
  }

  const json = (await res.json()) as GeminiResponse
  if (json.promptFeedback?.blockReason) {
    console.error('[renderImage] blocked', { model, blockReason: json.promptFeedback.blockReason })
    throw new AppError(422, 'That prompt was blocked by the image model. Try rewording it.', 'IP_RENDER_BLOCKED')
  }

  for (const part of json.candidates?.[0]?.content?.parts ?? []) {
    const inline = part.inlineData ?? (part.inline_data
      ? { mimeType: part.inline_data.mime_type, data: part.inline_data.data }
      : null)
    if (inline?.data) {
      return { data: Buffer.from(inline.data, 'base64'), mimeType: inline.mimeType || 'image/png' }
    }
  }

  const finish = json.candidates?.[0]?.finishReason
  if (finish && finish !== 'STOP') {
    // e.g. IMAGE_SAFETY / PROHIBITED_CONTENT — the model produced no image on purpose.
    console.error('[renderImage] no image', { model, finishReason: finish })
    throw new AppError(422, 'The image model wouldn’t render this prompt (it was flagged). Try rewording it.', 'IP_RENDER_BLOCKED')
  }
  console.error('[renderImage] empty response', { model, hasCandidates: !!json.candidates?.length })
  throw new AppError(502, 'The image model returned nothing. Please try again.', 'IP_RENDER_EMPTY')
}
