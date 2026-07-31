/**
 * Contrast helpers for the configurable brand accent.
 *
 * The default accent (#ED64A6) scores 3.01:1 on white — fine as a fill, but
 * below the WCAG AA 4.5:1 floor for normal-sized text. Since the accent is a
 * user setting, we can't hard-code a darker swatch; these derive one.
 */

export interface Rgb { r: number; g: number; b: number }

export function hexToRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colours, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const BLACK: Rgb = { r: 0, g: 0, b: 0 }

/** Blends `color` toward `target` by `amount` (0–1). */
function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  }
}

/**
 * A version of `accent` dark enough to read as text on `background`.
 *
 * Walks the accent toward black in small steps until it clears `target`. Keeps
 * the hue, so it still reads as the brand colour — just deep enough to be
 * legible. Returns the original when it already passes, and gives up at black
 * rather than looping.
 */
export function accessibleTextColor(accent: string, background = '#ffffff', target = 4.5): string {
  const base = hexToRgb(accent)
  const bg = hexToRgb(background)
  if (!base || !bg) return accent
  if (contrastRatio(base, bg) >= target) return accent

  for (let step = 1; step <= 20; step++) {
    const candidate = mix(base, BLACK, step / 20)
    if (contrastRatio(candidate, bg) >= target) return rgbToHex(candidate)
  }
  return '#000000'
}

/**
 * A version of `accent` dark enough that white text on top of it clears
 * `target` — for filled surfaces that carry text (buttons, badges, avatars).
 *
 * Same walk as accessibleTextColor but solving the inverse problem: there the
 * accent is the foreground, here it is the background. Keeps the hue, so the
 * surface still reads as the brand colour, just deep enough for white to sit on.
 */
export function accessibleFillColor(accent: string, on = '#ffffff', target = 4.5): string {
  const base = hexToRgb(accent)
  const fg = hexToRgb(on)
  if (!base || !fg) return accent
  if (contrastRatio(base, fg) >= target) return accent

  for (let step = 1; step <= 20; step++) {
    const candidate = mix(base, BLACK, step / 20)
    if (contrastRatio(candidate, fg) >= target) return rgbToHex(candidate)
  }
  return '#000000'
}

/**
 * Whether white or near-black text reads better on `accent` — for content sitting
 * ON a filled accent surface (buttons, badges, avatars).
 */
export function onAccentTextColor(accent: string): '#ffffff' | '#1f2937' {
  const base = hexToRgb(accent)
  if (!base) return '#ffffff'
  return contrastRatio(base, WHITE) >= contrastRatio(base, hexToRgb('#1f2937')!)
    ? '#ffffff'
    : '#1f2937'
}
