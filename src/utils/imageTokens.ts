/**
 * Plain-text token for an image embedded in a text field (a task description,
 * say): ![file name](https://res.cloudinary.com/…). Only the hosted URL is
 * stored — never the image data.
 *
 * Kept free of React so server code (services cleaning up removed images) can
 * import it; the rendering side lives in src/utils/mentions.tsx.
 */
export const IMAGE_TOKEN_RE = /!\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)/g

/** True for URLs we're willing to render as an inline image (hosted, https). */
export function isHostedImageUrl(url: string): boolean {
  return /^https:\/\/[^\s)]+$/.test(url)
}

/** Builds the plain-text image token to splice into a text field. */
export function formatImageToken(name: string, url: string): string {
  const safeName = name.replace(/[[\]()\n]/g, '').trim() || 'image'
  return `![${safeName}](${url})`
}

/** Dedup list of image URLs embedded in a text value. */
export function extractImageUrls(text: string): string[] {
  const urls = new Set<string>()
  for (const m of text.matchAll(IMAGE_TOKEN_RE)) if (m[2] && isHostedImageUrl(m[2])) urls.add(m[2])
  return [...urls]
}
