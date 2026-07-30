import { env } from '@/config/env'
import { AppError } from '@/lib/errors'
import type { ImageTier } from '@/types/image-pipeline'

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

export interface RenderImageInput {
  tier: ImageTier
  prompt: string
  /** Cloudinary URL of the reference image, when the run has one. */
  sourceImageUrl: string | null
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
  if (input.sourceImageUrl) {
    const reference = await fetchReference(input.sourceImageUrl)
    parts.push({ inlineData: { mimeType: reference.mimeType, data: reference.base64 } })
  }

  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      // Only the pro model honours an explicit size; sending it to the flash
      // model is ignored, so it's scoped to avoid a surprise 400.
      ...(input.tier === 'pro' ? { imageConfig: { imageSize: input.size } } : {}),
    },
  })

  let lastError: AppError | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500))
    try {
      return await callGemini(model, key, body)
    } catch (err) {
      if (!(err instanceof AppError)) throw err
      // Only transient failures are worth the second attempt.
      if (err.code !== 'IP_RENDER_TRANSIENT') throw err
      lastError = err
    }
  }
  throw lastError ?? new AppError(502, 'Couldn’t generate that image. Please try again.', 'IP_RENDER_FAILED')
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
  } catch {
    // Network error or timeout — worth one retry.
    throw new AppError(504, 'Image generation timed out. Please try again.', 'IP_RENDER_TRANSIENT')
  }

  if (!res.ok) {
    // Never log the response body — it echoes the prompt.
    console.error('[renderImage] provider error', { model, status: res.status })
    if (isRetryable(res.status)) {
      throw new AppError(502, 'Image generation is busy right now. Please try again.', 'IP_RENDER_TRANSIENT')
    }
    if (res.status === 401 || res.status === 403) {
      throw new AppError(503, 'Image generation isn’t set up correctly.', 'IP_GEMINI_NOT_CONFIGURED')
    }
    throw new AppError(502, 'Couldn’t generate that image. Please try again.', 'IP_RENDER_FAILED')
  }

  const json = (await res.json()) as GeminiResponse
  if (json.promptFeedback?.blockReason) {
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
    throw new AppError(422, 'That prompt was blocked by the image model. Try rewording it.', 'IP_RENDER_BLOCKED')
  }
  throw new AppError(502, 'The image model returned nothing. Please try again.', 'IP_RENDER_EMPTY')
}
