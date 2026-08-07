'use client'

import { useMemo, useState } from 'react'
import { Layers, ChevronDown } from 'lucide-react'
import InsightCard from './InsightCard'
import type { AnalyticsFilter, SegmentKind, SegmentStat } from '@/types/task-analytics'

interface BreakdownProps {
  brands: SegmentStat[]
  clients: SegmentStat[]
  people: SegmentStat[]
  priorities: SegmentStat[]
  /**
   * Which dimensions may be offered, in order. Defaults to all four; the client
   * portal passes a subset, since per-teammate figures are internal and a
   * per-client split says nothing in a portal holding one client.
   */
  dimensions?: SegmentKind[]
  filter?: AnalyticsFilter | null
  /** Omit to render rows as plain readouts — no drill-down. */
  onFilter?: (next: AnalyticsFilter | null) => void
}

const TAB_LABEL: Record<SegmentKind, string> = {
  brand: 'Brands',
  client: 'Clients',
  person: 'People',
  priority: 'Priority',
}

/** How many rows before the list folds. */
const COLLAPSED_ROWS = 6

/**
 * Who and what the work belongs to, one dimension at a time.
 *
 * Each row is a whole picture rather than a single number: how much is done,
 * how much is still open, and how much of that open work is late — so a brand
 * with 40 completed tasks and a wall of overdue ones can't hide behind its
 * total. Tapping a row narrows every other panel to it.
 */
export default function Breakdown({
  brands, clients, people, priorities,
  dimensions = ['brand', 'client', 'person', 'priority'],
  filter = null, onFilter,
}: BreakdownProps) {
  const [kind, setKind] = useState<SegmentKind>('brand')
  const [expanded, setExpanded] = useState(false)

  const lists = useMemo<Record<SegmentKind, SegmentStat[]>>(
    () => ({ brand: brands, client: clients, person: people, priority: priorities }),
    [brands, clients, people, priorities],
  )

  // Only offer a dimension that has something to say. A solo user with no
  // teammates shouldn't be given an empty People tab.
  const tabs = useMemo(
    () => dimensions.filter((k) => {
      const list = lists[k]
      if (list.length === 0) return false
      // A single catch-all row ("Unassigned", "No brand") isn't a breakdown.
      return !(list.length === 1 && list[0].id === '')
    }),
    [lists, dimensions],
  )

  const activeKind = tabs.includes(kind) ? kind : (tabs[0] ?? 'brand')
  const rows = lists[activeKind]
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS)

  // Bars are scaled against the busiest row, so the longest one always fills.
  const scale = useMemo(
    () => Math.max(1, ...rows.map((r) => r.completed + r.open)),
    [rows],
  )

  return (
    <InsightCard
      title="Breakdown"
      icon={<Layers size={14} className="text-gray-400" />}
      hint={onFilter ? 'Tap a row to narrow everything above to it' : 'Completed, still open, and how much of it is late'}
    >
      {/* Dimension switch — scrolls rather than wraps on narrow screens. */}
      <div className="-mx-1 px-1 mb-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 w-max bg-gray-100 rounded-lg p-0.5">
          {tabs.map((k) => (
            <button
              key={k}
              onClick={() => { setKind(k); setExpanded(false) }}
              className={`px-3 min-h-9 rounded-md text-xs2 font-medium transition-colors ${
                activeKind === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-3xs text-gray-400 mb-2">
        <Key color="var(--accent, #ED64A6)" label="Completed" />
        <Key color="#E5E7EB" label="Open" />
        <Key color="var(--danger)" label="Overdue" />
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-8 text-center">No tasks to break down for this period yet.</p>
      ) : (
        <>
          <ul className="space-y-0.5">
            {shown.map((row) => (
              <BreakdownRow
                key={`${activeKind}-${row.id || 'none'}`}
                row={row}
                kind={activeKind}
                scale={scale}
                filter={filter}
                onFilter={onFilter}
              />
            ))}
          </ul>

          {rows.length > COLLAPSED_ROWS && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 min-h-11 w-full flex items-center justify-center gap-1 text-xs2 font-medium text-gray-500 hover:text-gray-700"
            >
              {expanded ? 'Show less' : `Show all ${rows.length}`}
              <ChevronDown size={14} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
          )}
        </>
      )}
    </InsightCard>
  )
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

interface RowProps {
  row: SegmentStat
  kind: SegmentKind
  scale: number
  filter: AnalyticsFilter | null
  // Explicitly `| undefined` — exactOptionalPropertyTypes is on, so an omitted
  // handler has to be spelled out rather than merely marked optional.
  onFilter: ((next: AnalyticsFilter | null) => void) | undefined
}

function BreakdownRow({ row, kind, scale, filter, onFilter }: RowProps) {
  // Priority has no drill-down (there's nothing to scope a period to), the
  // catch-all rows have no id to filter by, and a caller that passes no handler
  // wants plain readouts.
  const filterable = !!onFilter && kind !== 'priority' && row.id !== ''
  const selected = filterable && filter?.kind === kind && filter.id === row.id
  const steady = Math.max(0, row.open - row.overdue)
  const width = (value: number) => `${(value / scale) * 100}%`

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs2 font-medium text-gray-800 truncate">
          {row.label}
          {row.sub && <span className="text-gray-400 font-normal"> · {row.sub}</span>}
        </p>
        <span className="text-xs2 font-medium text-gray-700 tabular-nums flex-shrink-0">{row.completed}</span>
      </div>

      <div className="mt-1.5 h-2 rounded-full bg-gray-50 overflow-hidden flex">
        <span className="h-full" style={{ width: width(row.completed), backgroundColor: 'var(--accent, #ED64A6)' }} />
        <span className="h-full bg-gray-200" style={{ width: width(steady) }} />
        <span className="h-full" style={{ width: width(row.overdue), backgroundColor: 'var(--danger)' }} />
      </div>

      <p className="text-3xs text-gray-400 mt-1 tabular-nums">
        {row.completed} completed · {row.open} open
        {row.overdue > 0 && <span className="text-red-500"> · {row.overdue} overdue</span>}
      </p>
    </>
  )

  if (!filterable) {
    return <li className="py-2 px-2 -mx-2">{body}</li>
  }

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onFilter?.(selected ? null : { kind: kind as AnalyticsFilter['kind'], id: row.id, label: row.label })}
        className={`w-full text-left min-h-11 py-2 px-2 -mx-2 rounded-xl transition-colors ${
          selected ? 'bg-gray-50 ring-1 ring-gray-200' : 'hover:bg-gray-50'
        }`}
      >
        {body}
      </button>
    </li>
  )
}
