/**
 * Helpers for handling user-uploaded custom fonts stored as data URLs.
 *
 * Fonts are persisted as base64 data URLs in settings. `FileReader.readAsDataURL`
 * often produces a generic `application/octet-stream` MIME for font files, and a
 * data URL has no file extension for the browser to sniff. Without an explicit
 * `format()` hint in the `@font-face` rule, browsers (Safari in particular)
 * silently reject the font. These helpers normalise the MIME at upload time and
 * derive the matching `format()` keyword at injection time.
 */

type FontExtension = 'ttf' | 'otf' | 'woff' | 'woff2'

const EXT_TO_MIME: Record<FontExtension, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

const MIME_TO_FORMAT: Record<string, string> = {
  'font/ttf': 'truetype',
  'font/otf': 'opentype',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
}

function extensionOf(fileName: string): FontExtension | null {
  const match = /\.([^.]+)$/.exec(fileName.toLowerCase())
  const ext = match?.[1]
  if (ext === 'ttf' || ext === 'otf' || ext === 'woff' || ext === 'woff2') return ext
  return null
}

/**
 * Rewrites the MIME segment of a font data URL to the correct font type based on
 * the original file extension, so the stored value is unambiguous regardless of
 * what MIME the browser assigned during `readAsDataURL`.
 */
export function normalizeFontDataUrl(dataUrl: string, fileName: string): string {
  const ext = extensionOf(fileName)
  if (!ext) return dataUrl
  return dataUrl.replace(/^data:[^;]*;/, `data:${EXT_TO_MIME[ext]};`)
}

/**
 * Builds the `src` value for an `@font-face` rule, appending a `format()` hint
 * derived from the data URL's MIME type when one can be determined.
 */
export function fontFaceSrc(dataUrl: string): string {
  const mime = /^data:([^;]+);/.exec(dataUrl)?.[1] ?? ''
  const format = MIME_TO_FORMAT[mime]
  return format ? `url('${dataUrl}') format('${format}')` : `url('${dataUrl}')`
}
