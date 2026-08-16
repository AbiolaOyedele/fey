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
 * OpenAI (ChatGPT) render engine — gpt-image-1 and gpt-image-1-mini.
 *
 * Two endpoints, picked by whether the run forwards reference images:
 *   • no references → /v1/images/generations (JSON)
 *   • references    → /v1/images/edits (multipart, one `image[]` part each)
 *
 * These models have no 2K option, so the preview/final split is expressed as
 * QUALITY rather than resolution: the 1K preview renders at low quality (fast
 * and cheap, enough to judge the composition), the approved final at high.
 * That keeps the two-gate economics intact — the expensive half is still only
 * spent on a preview the user has approved. The UI labels the real output size
 * per model rather than promising 2K across the board.
 *
 * Raw fetch rather than the SDK, matching the Gemini client and keeping the
 * dependency list to the confirmed stack. The key is server-only.
 *
 * Dispatched to by `renderImage` in image-render.ts — not called directly.
 */

const GENERATIONS_URL = 'https://api.openai.com/v1/images/generations'
const EDITS_URL = 'https://api.openai.com/v1/images/edits'

/** Square by default — the pipeline has no aspect-ratio control yet. */
const OUTPUT_SIZE = '1024x1024'
const OUTPUT_FORMAT = 'png'

interface OpenAIImageResponse {
  data?: { b64_json?: string }[]
  error?: { message?: string; type?: string; code?: string }
}

export function hasOpenAIKey(): boolean {
  return !!env.OPENAI_API_KEY
}

function requireKey(): string {
  if (!env.OPENAI_API_KEY) {
    throw new AppError(503, 'ChatGPT image generation isn’t set up yet.', 'IP_OPENAI_NOT_CONFIGURED')
  }
  return env.OPENAI_API_KEY
}

/** The 1K preview is a cheap draft; the approved final gets the good render. */
const qualityFor = (size: RenderImageInput['size']): 'low' | 'high' => (size === '2K' ? 'high' : 'low')

/** One OpenAI render attempt. Retries are the dispatcher's job. */
export async function renderWithOpenAI(input: RenderImageInput): Promise<RenderedImage> {
  const key = requireKey()
  const references = input.sourceImageUrls.slice(0, MAX_REFERENCE_IMAGES)

  // With references the directive has to ride along in the prompt itself —
  // unlike Gemini there is no separate trailing instruction part.
  const prompt = references.length > 0 ? `${input.prompt}\n\n${REFERENCE_DIRECTIVE}` : input.prompt

  const request = references.length > 0
    ? await buildEditRequest(input.model, prompt, input.size, references)
    : buildGenerateRequest(input.model, prompt, input.size)

  let res: Response
  try {
    res = await fetch(request.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, ...request.headers },
      body: request.body,
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    })
  } catch (err) {
    console.error('[renderImage] openai fetch failed', {
      model: input.model,
      name: (err as Error)?.name,
      message: (err as Error)?.message,
    })
    throw new AppError(504, 'Image generation timed out. Please try again.', 'IP_RENDER_TRANSIENT')
  }

  if (!res.ok) throw await openAIHttpError(res, input.model)

  const json = (await res.json()) as OpenAIImageResponse
  const b64 = json.data?.[0]?.b64_json
  if (!b64) {
    console.error('[renderImage] openai empty response', { model: input.model, items: json.data?.length ?? 0 })
    throw new AppError(502, 'The image model returned nothing. Please try again.', 'IP_RENDER_EMPTY')
  }
  return { data: Buffer.from(b64, 'base64'), mimeType: `image/${OUTPUT_FORMAT}` }
}

interface ProviderRequest {
  url: string
  headers: Record<string, string>
  body: BodyInit
}

function buildGenerateRequest(model: string, prompt: string, size: RenderImageInput['size']): ProviderRequest {
  return {
    url: GENERATIONS_URL,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: OUTPUT_SIZE,
      quality: qualityFor(size),
      output_format: OUTPUT_FORMAT,
    }),
  }
}

/**
 * Multipart edit request. Each reference is downloaded (and capped) then
 * attached as its own `image[]` part — these models accept several at once.
 * Fetched sequentially to keep peak memory bounded: they're up to 10MB each.
 */
async function buildEditRequest(
  model: string,
  prompt: string,
  size: RenderImageInput['size'],
  urls: string[],
): Promise<ProviderRequest> {
  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('n', '1')
  form.append('size', OUTPUT_SIZE)
  form.append('quality', qualityFor(size))
  // Stated rather than assumed — the bytes are handed to Cloudinary labelled
  // image/png, so the format must not be left to a provider default.
  form.append('output_format', OUTPUT_FORMAT)

  for (const [index, url] of urls.entries()) {
    const reference = await fetchReference(url)
    const extension = reference.mimeType.split('/')[1] ?? 'png'
    form.append(
      'image[]',
      new Blob([new Uint8Array(reference.bytes)], { type: reference.mimeType }),
      `reference-${index}.${extension}`,
    )
  }
  // No Content-Type header: fetch sets it with the multipart boundary.
  return { url: EDITS_URL, headers: {}, body: form }
}

/** Maps a non-2xx OpenAI response to the right AppError. */
async function openAIHttpError(res: Response, model: string): Promise<AppError> {
  // The error body is OpenAI's own description, not a prompt echo, so it's safe
  // to log. Success bodies are the ones we never log.
  const rawError = await res.text().catch(() => '')
  let providerMessage: string | undefined
  let providerCode: string | undefined
  try {
    const parsed = JSON.parse(rawError) as OpenAIImageResponse
    providerMessage = parsed.error?.message
    providerCode = parsed.error?.code ?? parsed.error?.type
  } catch {
    providerMessage = rawError.slice(0, 300) || undefined
  }
  console.error('[renderImage] openai provider error', {
    model,
    httpStatus: res.status,
    providerCode,
    providerMessage,
  })

  // Moderation refusals arrive as a 400 — rewording is the only way through, so
  // it must not be retried.
  if (/moderation|safety|content_policy/i.test(`${providerCode ?? ''} ${providerMessage ?? ''}`)) {
    return new AppError(422, 'That prompt was blocked by the image model. Try rewording it.', 'IP_RENDER_BLOCKED')
  }
  // A spent balance can't be fixed by retrying.
  if (res.status === 429 && /billing|quota|insufficient/i.test(providerMessage ?? '')) {
    return new AppError(
      402,
      'ChatGPT image generation is out of quota. That OpenAI account needs credit to generate images.',
      'IP_RENDER_QUOTA_EXHAUSTED',
    )
  }
  if (isRetryable(res.status)) {
    return transientError('Image generation is busy right now. Please try again.', retryAfterHeaderMs(res.headers))
  }
  if (res.status === 401 || res.status === 403) {
    return new AppError(503, 'ChatGPT image generation isn’t set up correctly.', 'IP_OPENAI_NOT_CONFIGURED')
  }
  if (res.status === 404) {
    return new AppError(502, 'That image model isn’t available. Pick another model and try again.', 'IP_RENDER_MODEL_NOT_FOUND')
  }
  // 400s here are almost always an unusable prompt — surface it as such rather
  // than as a generic failure the user can only retry into.
  if (res.status === 400) {
    return new AppError(422, 'The image model wouldn’t accept that prompt. Try rewording it.', 'IP_RENDER_BLOCKED')
  }
  return new AppError(502, 'Couldn’t generate that image. Please try again.', 'IP_RENDER_FAILED')
}
