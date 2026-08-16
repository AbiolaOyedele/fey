import { env } from '@/config/env'
import { AppError } from '@/lib/errors'
import { MAX_REFERENCE_IMAGES } from '@/types/image-pipeline'
import {
  fetchReference,
  isRetryable,
  REFERENCE_DIRECTIVE,
  RENDER_TIMEOUT_MS,
  retryAfterHeaderMs,
  transientError,
  type RenderImageInput,
  type RenderedImage,
} from '@/lib/image-render-shared'

/**
 * Gemini (Nano Banana) render engine.
 *
 * gemini-2.5-flash-image is "Nano Banana", gemini-3-pro-image is "Nano Banana
 * Pro". Only the pro model honours an explicit size hint, so on flash both the
 * preview and the final come back at the model's native resolution (which is
 * why the seeded rates price them identically).
 *
 * Raw fetch rather than an SDK: this is one endpoint, and it keeps the
 * dependency list to the confirmed stack. The key is server-only.
 *
 * Dispatched to by `renderImage` in image-render.ts — not called directly.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Models that accept an explicit output size; the rest ignore or reject it. */
const HONOURS_SIZE = new Set(['gemini-3-pro-image'])

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

export function hasGeminiKey(): boolean {
  return !!env.GEMINI_API_KEY
}

function requireKey(): string {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, 'Google image generation isn’t set up yet.', 'IP_GEMINI_NOT_CONFIGURED')
  }
  return env.GEMINI_API_KEY
}

/** One Gemini render attempt. Retries are the dispatcher's job. */
export async function renderWithGemini(input: RenderImageInput): Promise<RenderedImage> {
  const key = requireKey()

  const parts: GeminiPart[] = [{ text: input.prompt }]
  // Inline each reference image (capped). Fetched sequentially to keep peak
  // memory bounded — these are up to 10MB each.
  const references = input.sourceImageUrls.slice(0, MAX_REFERENCE_IMAGES)
  for (const url of references) {
    const reference = await fetchReference(url)
    parts.push({ inlineData: { mimeType: reference.mimeType, data: reference.bytes.toString('base64') } })
  }
  // Only meaningful when there's actually a reference to constrain. Goes last so
  // it is the final instruction the model reads.
  if (references.length > 0) parts.push({ text: REFERENCE_DIRECTIVE })

  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(HONOURS_SIZE.has(input.model) ? { imageConfig: { imageSize: input.size } } : {}),
    },
  })

  let res: Response
  try {
    res = await fetch(`${API_BASE}/${input.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    })
  } catch (err) {
    // Network error or timeout — worth another attempt.
    console.error('[renderImage] gemini fetch failed', {
      model: input.model,
      name: (err as Error)?.name,
      message: (err as Error)?.message,
    })
    throw new AppError(504, 'Image generation timed out. Please try again.', 'IP_RENDER_TRANSIENT')
  }

  if (!res.ok) throw await geminiHttpError(res, input.model)

  const json = (await res.json()) as GeminiResponse
  if (json.promptFeedback?.blockReason) {
    console.error('[renderImage] gemini blocked', { model: input.model, blockReason: json.promptFeedback.blockReason })
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
    console.error('[renderImage] gemini no image', { model: input.model, finishReason: finish })
    throw new AppError(422, 'The image model wouldn’t render this prompt (it was flagged). Try rewording it.', 'IP_RENDER_BLOCKED')
  }
  console.error('[renderImage] gemini empty response', { model: input.model, hasCandidates: !!json.candidates?.length })
  throw new AppError(502, 'The image model returned nothing. Please try again.', 'IP_RENDER_EMPTY')
}

/** Maps a non-2xx Gemini response to the right AppError. */
async function geminiHttpError(res: Response, model: string): Promise<AppError> {
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
  console.error('[renderImage] gemini provider error', {
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
    return new AppError(
      402,
      'Google image generation is out of quota. That API key needs billing enabled to generate images.',
      'IP_RENDER_QUOTA_EXHAUSTED',
    )
  }
  if (isRetryable(res.status)) {
    return transientError('Image generation is busy right now. Please try again.', retryAfterHeaderMs(res.headers))
  }
  if (res.status === 401 || res.status === 403) {
    return new AppError(503, 'Google image generation isn’t set up correctly.', 'IP_GEMINI_NOT_CONFIGURED')
  }
  if (res.status === 404) {
    return new AppError(502, 'That image model isn’t available. Pick another model and try again.', 'IP_RENDER_MODEL_NOT_FOUND')
  }
  return new AppError(502, 'Couldn’t generate that image. Please try again.', 'IP_RENDER_FAILED')
}
