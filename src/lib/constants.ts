export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', GBP: '£', EUR: '€',
  CAD: 'CA$', AUD: 'A$', JPY: '¥', CHF: 'CHF',
  INR: '₹', ZAR: 'R',
}

// ── File-upload security ─────────────────────────────────────────────────────
// Single source of truth for what may be uploaded anywhere in Fey. Enforced
// client-side (in utils/cloudinary) before any file reaches Cloudinary.

/** Hard size ceiling for any single upload. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB

/**
 * Extensions Fey accepts. Deliberately excludes executable / active-content
 * types (.exe, .js, .html, .svg, .sh, .bat, …) that can carry malware or run
 * in the browser. Keep in sync with ALLOWED_UPLOAD_MIME below.
 */
export const ALLOWED_UPLOAD_EXTENSIONS = [
  // images (note: svg intentionally excluded — it can carry scripts)
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic',
  // documents
  'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages',
  // spreadsheets
  'xls', 'xlsx', 'csv', 'numbers',
  // presentations
  'ppt', 'pptx', 'key',
  // archives
  'zip',
  // video / audio
  'mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav', 'm4a',
] as const

/** Disallowed by extension regardless of anything else (defense in depth). */
export const BLOCKED_UPLOAD_EXTENSIONS = [
  'exe', 'msi', 'bat', 'cmd', 'sh', 'js', 'mjs', 'jar', 'app', 'dmg',
  'com', 'scr', 'vbs', 'ps1', 'html', 'htm', 'svg', 'php', 'py',
] as const
