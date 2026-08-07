import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import * as repo from '@/repositories/task-analytics.repository'
import { getMembersMap } from '@/repositories/work-tasks.repository'
import type { AnalyticsTaskRow } from '@/repositories/task-analytics.repository'
import { PRIORITY_ORDER } from '@/types/task-analytics'
import type {
  AnalyticsRange, DailyPoint, DueBuckets, PreviousTotals,
  RangeTotals, SegmentStat, TaskAnalytics,
} from '@/types/task-analytics'
import type { TaskPriority } from '@/types/work-tasks'

/**
 * Turns raw task rows into the numbers behind Tasks → Insights.
 *
 * Two clocks run here on purpose. Anything phrased as an achievement
 * (completed, created, turnaround) is scoped to the selected range; anything
 * phrased as a state (open, overdue) is as of right now. Mixing them would
 * make "open" shrink when someone picks a shorter range, which is nonsense —
 * the backlog doesn't care what window you're looking through.
 *
 * Days are the viewer's calendar days, not UTC ones: the client sends its
 * timezone offset so "completed today" means what the user thinks it means.
 */

const DAY_MS = 86_400_000

/** How many days each range covers, inclusive of today. */
const RANGE_DAYS: Record<AnalyticsRange, number> = { '30d': 30, '90d': 90, '12m': 365 }

/** The activity map always shows a full year, whatever range is selected. */
const HISTORY_DAYS = 365

const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

const querySchema = z.object({
  range: z.enum(['30d', '90d', '12m']).default('30d'),
  /** Minutes, as reported by Date#getTimezoneOffset (UTC+1 → -60). */
  tzOffset: z.number().int().min(-840).max(840).default(0),
  projectId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
})

// ── Day arithmetic (calendar days as `YYYY-MM-DD`) ────────────────────────────

/** The calendar day an instant falls on, in the viewer's timezone. */
function dayKey(iso: string, tzOffset: number): string {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  return new Date(ms - tzOffset * 60_000).toISOString().slice(0, 10)
}

function addDays(day: string, delta: number): string {
  return new Date(new Date(`${day}T00:00:00.000Z`).getTime() + delta * DAY_MS).toISOString().slice(0, 10)
}

/** The instant a calendar day starts, in the viewer's timezone, as an ISO timestamp. */
function startOfDayISO(day: string, tzOffset: number): string {
  return new Date(new Date(`${day}T00:00:00.000Z`).getTime() + tzOffset * 60_000).toISOString()
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole
}

// ── Per-task derived facts ────────────────────────────────────────────────────

interface Fact {
  row: AnalyticsTaskRow
  createdDay: string
  /** The day it was finished, for done tasks only. */
  completedDay: string | null
  /** Hours from creation to completion, for done tasks only. */
  cycleHours: number | null
  /** Whether it landed on or before its due date. Null when it had no due date. */
  onTime: boolean | null
  /** Open right now and past its due date. */
  overdue: boolean
}

/**
 * `completed_at` is written whenever a task is marked done, but rows that
 * predate that column (or came in through an import) can be done without one —
 * `updated_at` is the closest honest stand-in rather than dropping them.
 */
function completionInstant(row: AnalyticsTaskRow): string | null {
  if (!row.done) return null
  return row.completed_at ?? row.updated_at
}

function toFact(row: AnalyticsTaskRow, tzOffset: number, today: string): Fact {
  const finishedAt = completionInstant(row)
  const completedDay = finishedAt ? dayKey(finishedAt, tzOffset) : null
  const createdMs = new Date(row.created_at).getTime()
  const cycleHours = finishedAt
    ? Math.max(0, (new Date(finishedAt).getTime() - createdMs) / 3_600_000)
    : null
  return {
    row,
    createdDay: dayKey(row.created_at, tzOffset),
    completedDay,
    cycleHours,
    onTime: completedDay && row.due_date ? completedDay <= row.due_date : null,
    overdue: !row.done && !!row.due_date && row.due_date < today,
  }
}

/**
 * Narrows a member's view the same way the task list does: they keep every
 * unlinked task RLS already gave them, but only the client/brand tasks they
 * created or are assigned to. Only ever removes rows.
 */
function scopeToViewer(rows: AnalyticsTaskRow[], viewer: { id: string; isAdmin: boolean }): AnalyticsTaskRow[] {
  if (viewer.isAdmin) return rows
  return rows.filter((r) => {
    const linked = r.project_id !== null || r.contact_id !== null
    if (!linked) return true
    return r.created_by === viewer.id || r.assignee_ids.includes(viewer.id)
  })
}

// ── Breakdowns ────────────────────────────────────────────────────────────────

interface SegmentKey { id: string; label: string; sub: string | null }

/**
 * Rolls facts up into one breakdown. `keysOf` may return more than one key
 * (a task with three assignees counts once for each of them), so the rows of a
 * people breakdown legitimately add up to more than the task total.
 */
function collect(
  facts: Fact[],
  keysOf: (f: Fact) => SegmentKey[],
  completedInRange: (f: Fact) => boolean,
): SegmentStat[] {
  const map = new Map<string, SegmentStat>()
  for (const f of facts) {
    for (const key of keysOf(f)) {
      let stat = map.get(key.id)
      if (!stat) {
        stat = { id: key.id, label: key.label, sub: key.sub, completed: 0, open: 0, overdue: 0 }
        map.set(key.id, stat)
      }
      if (!stat.sub && key.sub) stat.sub = key.sub
      if (completedInRange(f)) stat.completed += 1
      if (!f.row.done) {
        stat.open += 1
        if (f.overdue) stat.overdue += 1
      }
    }
  }
  return [...map.values()]
    // A task finished before the window and long since closed leaves an empty
    // row behind — drop it rather than show a brand with nothing to report.
    .filter((s) => s.completed > 0 || s.open > 0)
    .sort((a, b) => {
      // The catch-all row ("No brand", "Unassigned") always sits last.
      if ((a.id === '') !== (b.id === '')) return a.id === '' ? 1 : -1
      return b.completed - a.completed || b.open - a.open || a.label.localeCompare(b.label)
    })
}

function buildDueBuckets(facts: Fact[], today: string): DueBuckets {
  const weekEnd = addDays(today, 7)
  const due: DueBuckets = { overdue: 0, today: 0, week: 0, later: 0, none: 0 }
  for (const f of facts) {
    if (f.row.done) continue
    const d = f.row.due_date
    if (!d) due.none += 1
    else if (d < today) due.overdue += 1
    else if (d === today) due.today += 1
    else if (d <= weekEnd) due.week += 1
    else due.later += 1
  }
  return due
}

/** Consecutive days with a completion, counting back from today (or yesterday). */
function completionStreak(byDay: Map<string, DailyPoint>, today: string): number {
  let day = (byDay.get(today)?.completed ?? 0) > 0 ? today : addDays(today, -1)
  let streak = 0
  while ((byDay.get(day)?.completed ?? 0) > 0) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function getTaskAnalytics(
  db: SupabaseClient,
  ownerId: string,
  input: unknown,
  viewer: { id: string; isAdmin: boolean },
): Promise<TaskAnalytics> {
  const parsed = querySchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, 'That insights view isn’t available.', 'TASK_ANALYTICS_INVALID_QUERY')
  }
  const { range, tzOffset, projectId, contactId, assigneeId } = parsed.data

  const days = RANGE_DAYS[range]
  const today = dayKey(new Date().toISOString(), tzOffset)
  const from = addDays(today, -(days - 1))
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(days - 1))
  const historyFrom = addDays(today, -(HISTORY_DAYS - 1))
  // Pull from whichever start is earliest: the year of history the activity map
  // draws, or the previous window the deltas compare against.
  const earliest = prevFrom < historyFrom ? prevFrom : historyFrom

  const rows = await repo.listTasksForAnalytics(db, {
    ownerId,
    since: startOfDayISO(earliest, tzOffset),
    projectId: projectId ?? null,
    contactId: contactId ?? null,
    assigneeId: assigneeId ?? null,
  })

  const facts = scopeToViewer(rows, viewer).map((r) => toFact(r, tzOffset, today))

  // ── Daily series (a full year, zero-filled) ────────────────────────────────
  const byDay = new Map<string, DailyPoint>()
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const date = addDays(historyFrom, i)
    byDay.set(date, { date, created: 0, completed: 0 })
  }
  for (const f of facts) {
    const created = byDay.get(f.createdDay)
    if (created) created.created += 1
    if (f.completedDay) {
      const completed = byDay.get(f.completedDay)
      if (completed) completed.completed += 1
    }
  }
  const daily = [...byDay.values()]

  // ── Range + previous-range totals ──────────────────────────────────────────
  const inRange = (day: string | null): boolean => !!day && day >= from && day <= today
  const inPrev = (day: string | null): boolean => !!day && day >= prevFrom && day <= prevTo

  const completedNow = facts.filter((f) => inRange(f.completedDay))
  const completedPrev = facts.filter((f) => inPrev(f.completedDay))
  const createdNow = facts.filter((f) => inRange(f.createdDay))
  const createdPrev = facts.filter((f) => inPrev(f.createdDay))

  const onTimeRate = (set: Fact[]): number | null => {
    const withDue = set.filter((f) => f.onTime !== null)
    return ratio(withDue.filter((f) => f.onTime).length, withDue.length)
  }

  const rangeDaily = daily.filter((d) => d.date >= from && d.date <= today)
  const best = rangeDaily.reduce<DailyPoint | null>(
    (acc, d) => (d.completed > 0 && (!acc || d.completed > acc.completed) ? d : acc),
    null,
  )

  const totals: RangeTotals = {
    completed: completedNow.length,
    created: createdNow.length,
    open: facts.filter((f) => !f.row.done).length,
    overdue: facts.filter((f) => f.overdue).length,
    completionRate: ratio(createdNow.filter((f) => f.row.done).length, createdNow.length),
    onTimeRate: onTimeRate(completedNow),
    medianCycleHours: median(completedNow.map((f) => f.cycleHours).filter((h): h is number => h !== null)),
    activeDays: rangeDaily.filter((d) => d.completed > 0).length,
    streak: completionStreak(byDay, today),
    best: best ? { date: best.date, completed: best.completed } : null,
  }

  const previous: PreviousTotals = {
    completed: completedPrev.length,
    created: createdPrev.length,
    onTimeRate: onTimeRate(completedPrev),
    medianCycleHours: median(completedPrev.map((f) => f.cycleHours).filter((h): h is number => h !== null)),
  }

  // ── Breakdowns ─────────────────────────────────────────────────────────────
  const members = await getMembersMap(db, ownerId)
  const completedInRange = (f: Fact): boolean => inRange(f.completedDay)

  const brands = collect(facts, (f) => [{
    id: f.row.project_id ?? '',
    label: f.row.project_title ?? 'No brand',
    sub: f.row.project_id ? f.row.contact_name : null,
  }], completedInRange)

  const clients = collect(facts, (f) => [{
    id: f.row.contact_id ?? '',
    label: f.row.contact_name ?? 'Internal',
    sub: null,
  }], completedInRange)

  const people = collect(facts, (f) => (
    f.row.assignee_ids.length === 0
      ? [{ id: '', label: 'Unassigned', sub: null }]
      : f.row.assignee_ids.map((uid) => {
        const m = members.get(uid)
        return { id: uid, label: m?.name ?? m?.email ?? 'Teammate', sub: null }
      })
  ), completedInRange)

  // Priority is the one breakdown with a natural order — high always reads
  // first, however little of it there is.
  const priorities = collect(facts, (f) => [{
    id: f.row.priority,
    label: PRIORITY_LABEL[f.row.priority] ?? 'Medium',
    sub: null,
  }], completedInRange).sort((a, b) => (
    PRIORITY_ORDER.indexOf(a.id as TaskPriority) - PRIORITY_ORDER.indexOf(b.id as TaskPriority)
  ))

  return {
    range,
    from,
    to: today,
    daily,
    totals,
    previous,
    brands,
    clients,
    people,
    priorities,
    due: buildDueBuckets(facts, today),
  }
}
