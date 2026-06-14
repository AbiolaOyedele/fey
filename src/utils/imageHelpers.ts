/**
 * Client-side image compression for user uploads stored as data URLs.
 *
 * Uploads (logos, avatars) are persisted as base64 data URLs in settings.
 * Storing a multi-megabyte original makes every page that renders the asset slow
 * and bloats the settings row. We accept a generous source file, then downscale
 * and re-encode it to a compact WebP so the stored value stays small and loads
 * fast — while preserving transparency (logos are often PNGs with alpha).
 */

interface CompressOptions {
  /** Longest-edge cap in pixels. The image is scaled down to fit, never up. */
  maxDimension: number
  /** WebP quality, 0–1. */
  quality: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image could not be decoded'))
    img.src = src
  })
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('File could not be read'))
    reader.readAsDataURL(file)
  })
}

/**
 * Downscales and re-encodes an image file to a compact WebP data URL.
 *
 * Falls back to the original (read as a data URL) if the browser cannot decode
 * or re-encode the image — callers always get a usable data URL back.
 */
export async function compressImage(
  file: File,
  { maxDimension, quality }: CompressOptions,
): Promise<string> {
  const original = await readAsDataUrl(file)
  try {
    const img = await loadImage(original)
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
    const width = Math.round(img.width * scale)
    const height = Math.round(img.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(img, 0, 0, width, height)

    const compressed = canvas.toDataURL('image/webp', quality)
    // Some browsers return a PNG data URL when WebP is unsupported; only adopt
    // the result when it is genuinely WebP and actually smaller than the source.
    if (compressed.startsWith('data:image/webp') && compressed.length < original.length) {
      return compressed
    }
    return original
  } catch {
    return original
  }
}
