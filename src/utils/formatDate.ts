/**
 * Centralised date formatting for Fey. All user-facing dates render as
 * `dd/mm/yyyy` (with optional time) so the app is consistent everywhere.
 *
 * Use these helpers instead of calling `toLocaleDateString` / `toLocaleString`
 * directly. `relativeTime` (in ./relativeTime) handles "5m ago" style chat
 * timestamps and falls back to `formatDate` for anything older.
 */

type DateInput = string | number | Date | null | undefined

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * `dd/mm/yyyy` — the canonical Fey date format.
 * Returns an empty string for missing/invalid input.
 */
export function formatDate(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * `dd/mm/yyyy HH:mm` (24-hour). Returns an empty string for missing input.
 */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Friendly long form, e.g. `15 Jun 2026`. For headings/labels where the
 * slash form feels terse. Still day-first to match the rest of the app.
 */
export function formatDateLong(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Just the time, `HH:mm` (24-hour). For grouped chat views where the date
 * is shown separately.
 */
export function formatTime(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
