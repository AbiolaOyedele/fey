/**
 * Ruff Tools — pure, side-effect-free helpers for client-side image work.
 * Ported from the Sahl "Winston" tools suite; framework-agnostic canvas/file
 * helpers shared by every tool in the corner.
 */
import type { CSSProperties } from 'react'

/** Checkerboard background that signals transparency behind a cutout. */
export const CHECKER: CSSProperties = {
  background: 'repeating-conic-gradient(#e2e5ea 0% 25%, #f3f4f6 0% 50%) 0 0 / 16px 16px',
}

/** Load a File/Blob/URL into a decoded HTMLImageElement. */
export function loadImage(fileOrUrl: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const isUrl = typeof fileOrUrl === 'string'
    const url = isUrl ? fileOrUrl : URL.createObjectURL(fileOrUrl)
    const img = new Image()
    // Cloudinary-hosted saved watermarks are cross-origin; allow canvas export.
    if (isUrl) img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!isUrl) URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      if (!isUrl) URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }
    img.src = url
  })
}

/** Turn a canvas into a Blob (Promise). */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), type, quality)
  })
}

/** Trigger a browser download for a Blob or object URL. */
export function downloadBlob(blob: Blob | string, filename: string): void {
  const url = blob instanceof Blob ? URL.createObjectURL(blob) : blob
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (blob instanceof Blob) setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Strip the extension from a filename. */
export function stem(name = 'image'): string {
  return name.replace(/\.[^/.]+$/, '')
}

/** Pull the first image File out of a clipboard paste event, or null. */
export function imageFromPaste(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items
  if (!items) return null
  for (const item of items) {
    if (item.type.startsWith('image/')) return item.getAsFile()
  }
  return null
}

/**
 * Knock the flat background out of a logo or watermark.
 *
 * Samples the four corners to learn the background colour, then clears every
 * pixel within `tolerance` (0–100) of it. Pixels just outside the threshold get
 * a partial alpha so anti-aliased type keeps a soft edge instead of a jagged
 * halo. Returns a fresh canvas — the source image is untouched.
 *
 * Throws if the source is a cross-origin image the browser won't let us read.
 */
export function keyOutBackground(
  source: HTMLImageElement | HTMLCanvasElement,
  tolerance = 15,
): HTMLCanvasElement {
  const w = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth
  const h = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || !w || !h) throw new Error('Could not read that watermark')
  ctx.drawImage(source, 0, 0)

  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  const at = (x: number, y: number) => (y * w + x) * 4

  // Average the corners, ignoring any that are already transparent.
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)]
    .filter((i) => px[i + 3] > 8)
  if (corners.length === 0) return canvas // already cut out — nothing to key
  const bg = corners.reduce(
    (acc, i) => ({ r: acc.r + px[i] / corners.length, g: acc.g + px[i + 1] / corners.length, b: acc.b + px[i + 2] / corners.length }),
    { r: 0, g: 0, b: 0 },
  )

  // Euclidean RGB distance, scaled against the largest possible distance.
  const hard = (tolerance / 100) * 441.67
  const soft = hard * 1.6

  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    const dr = px[i] - bg.r
    const dg = px[i + 1] - bg.g
    const db = px[i + 2] - bg.b
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist <= hard) {
      px[i + 3] = 0
    } else if (dist < soft) {
      px[i + 3] = Math.round(px[i + 3] * ((dist - hard) / (soft - hard)))
    }
  }

  ctx.putImageData(data, 0, 0)
  return canvas
}

/** Format a byte count as a short human string. */
export function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
