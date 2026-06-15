import { formatDate } from './formatDate'

/**
 * Compact relative time, e.g. "just now", "5m ago", "3h ago", "yesterday",
 * "4d ago", "2w ago", then an absolute date for anything older.
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const min = Math.floor(diffMs / 60_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'yesterday'
  if (day < 7)  return `${day}d ago`
  const wk = Math.floor(day / 7)
  if (wk < 5)   return `${wk}w ago`
  return formatDate(iso)
}

/** True when the timestamp is within the last `days` days. */
export function isActiveWithin(iso: string | null | undefined, days = 7): boolean {
  if (!iso) return false
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return false
  return Date.now() - then <= days * 24 * 60 * 60 * 1000
}
