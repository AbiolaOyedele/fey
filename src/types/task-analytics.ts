// Shapes for the task insights panel (Tasks → Insights, and the dashboard card).
// Everything here is derived from work_tasks — see
// src/services/task-analytics.service.ts for how each number is calculated.

import type { TaskPriority } from '@/types/work-tasks'

/** How far back the headline numbers look. */
export type AnalyticsRange = '30d' | '90d' | '12m'

/** Which dimension a breakdown slices by. */
export type SegmentKind = 'brand' | 'client' | 'person' | 'priority'

/** One day of activity. `date` is a calendar day in the viewer's timezone. */
export interface DailyPoint {
  date: string
  created: number
  completed: number
}

/**
 * One row of a breakdown — a brand, client, teammate or priority.
 * `completed` is scoped to the selected range; `open`/`overdue` are as of now.
 */
export interface SegmentStat {
  /** Real id (project/contact/user), or an empty string for the catch-all row. */
  id: string
  label: string
  /** Secondary line, e.g. the client a brand belongs to. */
  sub: string | null
  completed: number
  open: number
  overdue: number
}

/** Open tasks grouped by how urgent their due date is. */
export interface DueBuckets {
  overdue: number
  today: number
  week: number
  later: number
  none: number
}

export interface RangeTotals {
  /** Tasks completed inside the range. */
  completed: number
  /** Tasks created inside the range. */
  created: number
  /** Tasks still open right now (not range-scoped). */
  open: number
  /** Open tasks past their due date right now. */
  overdue: number
  /** Share of tasks created in the range that are now done (0–1). Null when none were created. */
  completionRate: number | null
  /** Share of completed tasks that landed on or before their due date (0–1). Null when none had a due date. */
  onTimeRate: number | null
  /** Median hours from creation to completion. Null when nothing completed. */
  medianCycleHours: number | null
  /** Days in the range with at least one completion. */
  activeDays: number
  /** Consecutive days with a completion, counting back from today. */
  streak: number
  /** The single busiest day in the range. */
  best: { date: string; completed: number } | null
}

/** The same window immediately before the current one, for deltas. */
export interface PreviousTotals {
  completed: number
  created: number
  onTimeRate: number | null
  medianCycleHours: number | null
}

export interface TaskAnalytics {
  range: AnalyticsRange
  /** First and last day of the range, inclusive, as calendar days. */
  from: string
  to: string
  /**
   * Created/completed per day for the last year, oldest first and zero-filled.
   * Always a full year regardless of range so the activity map stays complete —
   * the headline numbers only read the slice inside the range.
   */
  daily: DailyPoint[]
  totals: RangeTotals
  previous: PreviousTotals
  brands: SegmentStat[]
  clients: SegmentStat[]
  people: SegmentStat[]
  priorities: SegmentStat[]
  due: DueBuckets
}

/** What the panel is narrowed to. Held in the UI and sent back as query params. */
export interface AnalyticsFilter {
  kind: Exclude<SegmentKind, 'priority'>
  id: string
  label: string
}

export const PRIORITY_ORDER: TaskPriority[] = ['high', 'medium', 'low']
