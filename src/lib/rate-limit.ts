/**
 * Fixed-window in-memory rate limiter.
 *
 * Scope note: the counter lives in the process, so on serverless the limit is
 * per instance rather than global — enough to stop one client hammering an
 * expensive endpoint, not a billing control. The real spend guards are the
 * credit ledger and the in-flight cap, both enforced in Postgres.
 */

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()
/** Bound the map so a burst of distinct keys can't grow it without limit. */
const MAX_KEYS = 10_000

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the window resets — for the Retry-After header. */
  retryAfter: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = windows.get(key)

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_KEYS) sweep(now)
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  existing.count += 1
  if (existing.count > limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) }
  }
  return { allowed: true, retryAfter: 0 }
}

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}
