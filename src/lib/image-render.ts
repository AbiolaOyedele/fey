import { AppError } from '@/lib/errors'
import { hasGeminiKey, renderWithGemini } from '@/lib/gemini'
import { hasOpenAIKey, renderWithOpenAI } from '@/lib/openai-image'
import { findImageModel, type ImageProvider } from '@/types/image-pipeline'
import type { RenderImageInput, RenderedImage } from '@/lib/image-render-shared'

/**
 * The Image Pipeline's render step: picks the engine named by the run's
 * `image_model` and retries the transient failures.
 *
 * The retry policy lives here rather than in either provider client so both
 * behave identically — image generation is slow (~20s+) and both APIs
 * rate-limit bursts, so 429/5xx are routine rather than exceptional. Anything a
 * retry cannot fix (a blocked prompt, an exhausted balance, a bad key) is
 * thrown straight through instead of burning the budget on it.
 */

export type { RenderSize, RenderedImage, RenderImageInput } from '@/lib/image-render-shared'

const BACKOFFS_MS = [0, 2000, 5000, 9000]

/** Whether a provider has a key configured, so the UI only offers what works. */
export function isProviderConfigured(provider: ImageProvider): boolean {
  return provider === 'openai' ? hasOpenAIKey() : hasGeminiKey()
}

/**
 * Renders one image on the model given. Throws an AppError with a plain-English
 * message on failure — the caller marks the run failed and refunds the step.
 */
export async function renderImage(input: RenderImageInput): Promise<RenderedImage> {
  const meta = findImageModel(input.model)
  if (!meta) {
    // Unreachable through the API (the service validates first); reachable if a
    // stored run names a model that has since left the catalogue.
    throw new AppError(502, 'That image model is no longer available. Pick another model and try again.', 'IP_RENDER_MODEL_NOT_FOUND')
  }
  const render = meta.provider === 'openai' ? renderWithOpenAI : renderWithGemini

  let lastError: AppError | null = null
  for (let attempt = 0; attempt < BACKOFFS_MS.length; attempt++) {
    if (attempt > 0) {
      const hinted = retryAfterMsOf(lastError)
      await new Promise((resolve) => setTimeout(resolve, hinted ?? BACKOFFS_MS[attempt] ?? 9000))
    }
    try {
      return await render(input)
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
