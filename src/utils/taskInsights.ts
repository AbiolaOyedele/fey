/**
 * Pure shaping and formatting helpers for the task insights panel.
 *
 * The API hands back one flat year of daily counts; everything here turns that
 * into the shapes the charts draw — bars bucketed to fit the range, and the
 * week columns of the activity map — plus the small formatters the tiles share.
 * No fetching, no state.
 */

import { hexToRgb } from '@/utils/color'
import type { AnalyticsRange, DailyPoint } from '@/types/task-analytics'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Parses a `YYYY-MM-DD` calendar day without letting the local timezone shift it. */
function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

/** 0 = Monday … 6 = Sunday. */
function weekdayIndex(day: string): number {
  return (parseDay(day).getUTCDay() + 6) % 7
}

function shiftDay(day: string, delta: number): string {
  return new Date(parseDay(day).getTime() + delta * 86_400_000).toISOString().slice(0, 10)
}

// ── Formatting ────────────────────────────────────────────────────────────────

/** `4 Aug` */
export function formatShortDay(day: string): string {
  const d = parseDay(day)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** `Mon 4 Aug` */
export function formatLongDay(day: string): string {
  const d = parseDay(day)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** `72%`, or an em dash when there is nothing to measure. */
export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

/** Turnaround in the largest unit that still reads naturally: `40m`, `6h`, `2.4d`. */
export function formatDuration(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`
  if (hours < 24) return `${Math.round(hours)}h`
  const days = hours / 24
  return days < 10 ? `${days.toFixed(1)}d` : `${Math.round(days)}d`
}

/**
 * Percentage change against the previous period.
 *
 * Null when there is no honest comparison to make — going from nothing to
 * something isn't "+100%", and the tiles say "no comparison" instead.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

/** The accent at a given opacity, for tints on white cards. */
export function accentAlpha(accent: string, alpha: number): string {
  const rgb = hexToRgb(accent) ?? { r: 237, g: 100, b: 166 }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

// ── Momentum bars ─────────────────────────────────────────────────────────────

export type Bucketing = 'day' | 'week' | 'month'

export interface SeriesBar {
  key: string
  /** Axis label — kept to a couple of characters so 30 of them fit on a phone. */
  label: string
  /** What the tooltip says, e.g. `4–10 Aug`. */
  title: string
  created: number
  completed: number
}

/** Days per bar, chosen so a 375px-wide chart never drops below ~8px per bar. */
const BUCKET_FOR_RANGE: Record<AnalyticsRange, Bucketing> = {
  '30d': 'day',
  '90d': 'week',
  '12m': 'month',
}

/**
 * Slices the year of daily counts down to the selected range and groups it into
 * bars: a day each for a month, a week each for a quarter, a month each for a
 * year. Always returns bars in chronological order, zero-filled.
 */
export function buildSeries(
  daily: DailyPoint[],
  from: string,
  to: string,
  range: AnalyticsRange,
): { bars: SeriesBar[]; bucket: Bucketing } {
  const bucket = BUCKET_FOR_RANGE[range]
  const window = daily.filter((d) => d.date >= from && d.date <= to)

  if (bucket === 'day') {
    return {
      bucket,
      bars: window.map((d) => ({
        key: d.date,
        label: String(parseDay(d.date).getUTCDate()),
        title: formatLongDay(d.date),
        created: d.created,
        completed: d.completed,
      })),
    }
  }

  const groups = new Map<string, { first: string; last: string; created: number; completed: number }>()
  for (const d of window) {
    const key = bucket === 'week' ? shiftDay(d.date, -weekdayIndex(d.date)) : d.date.slice(0, 7)
    const g = groups.get(key)
    if (!g) groups.set(key, { first: d.date, last: d.date, created: d.created, completed: d.completed })
    else {
      g.last = d.date
      g.created += d.created
      g.completed += d.completed
    }
  }

  const bars = [...groups.entries()].map(([key, g]) => {
    const start = parseDay(g.first)
    return {
      key,
      label: bucket === 'week'
        ? String(start.getUTCDate())
        : MONTHS[start.getUTCMonth()].slice(0, 1),
      title: bucket === 'week'
        ? `${formatShortDay(g.first)} – ${formatShortDay(g.last)}`
        : `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
      created: g.created,
      completed: g.completed,
    }
  })

  return { bucket, bars }
}

// ── Activity map ──────────────────────────────────────────────────────────────

export interface HeatWeek {
  key: string
  /** Seven slots, Monday first. Null pads the part-weeks at either end. */
  days: Array<DailyPoint | null>
}

export interface Heatmap {
  weeks: HeatWeek[]
  /** Month captions, positioned by the week column each month starts in. */
  months: Array<{ column: number; label: string }>
  /** The busiest day in view — the top of the colour scale. */
  max: number
}

/**
 * Lays the year of daily counts out as week columns, the way a contribution
 * graph reads: each column is one week, Monday at the top.
 */
export function buildHeatmap(daily: DailyPoint[]): Heatmap {
  if (daily.length === 0) return { weeks: [], months: [], max: 0 }

  const weeks: HeatWeek[] = []
  const months: Array<{ column: number; label: string }> = []
  let current: HeatWeek | null = null
  let max = 0
  let lastMonth = ''

  for (const point of daily) {
    const index = weekdayIndex(point.date)
    if (!current || index === 0) {
      current = { key: point.date, days: Array<DailyPoint | null>(7).fill(null) }
      weeks.push(current)
    }
    current.days[index] = point
    if (point.completed > max) max = point.completed

    const month = point.date.slice(0, 7)
    if (month !== lastMonth) {
      lastMonth = month
      const label = MONTHS[parseDay(point.date).getUTCMonth()]
      // Only caption a month once it owns most of a column, so labels don't collide.
      if (months[months.length - 1]?.column !== weeks.length - 1) {
        months.push({ column: weeks.length - 1, label })
      }
    }
  }

  return { weeks, months, max }
}

/**
 * Which of five steps a day's count sits on. Step 0 is "nothing happened" and
 * renders as an empty cell; 1–4 scale up to the busiest day in view.
 */
export function heatLevel(completed: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (completed <= 0) return 0
  if (max <= 1) return 4
  const share = completed / max
  if (share <= 0.25) return 1
  if (share <= 0.5) return 2
  if (share <= 0.75) return 3
  return 4
}
