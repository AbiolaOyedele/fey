'use client'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Content-shaped loading states.
 *
 * Each one mirrors the component it stands in for — same card, same padding,
 * same row height — so the page doesn't reflow when the real data lands. That
 * is the whole point of a skeleton over a spinner: a centred spinner says
 * "something is happening", a skeleton says "this is what's coming, and it will
 * be exactly here".
 *
 * Keep these next to the components they shadow. If a row's height changes,
 * change it here too — a skeleton that jumps on swap is worse than none.
 */

/** Deterministic width variation, so rows don't look like a printed grid. */
const TITLE_WIDTHS = ['w-40', 'w-56', 'w-32', 'w-48', 'w-36', 'w-52']

function titleWidth(i: number): string {
  return TITLE_WIDTHS[i % TITLE_WIDTHS.length]
}

/**
 * Task rows in a list view. Mirrors TaskListView's card wrapper and TaskRow's
 * circle + title + trailing chips at the same 2.5 padding.
 */
export function TaskRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 sm:px-4 py-2.5">
          <Skeleton className="w-5 h-5 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className={`h-3.5 ${titleWidth(i)} max-w-full`} />
          </div>
          {/* Same trailing order and widths as TaskRow — avatars, then a fixed
              w-20 due column, then the priority flag — so the title doesn't
              change length when the real row replaces this one. */}
          <Skeleton className="w-[22px] h-[22px] rounded-full flex-shrink-0" />
          <div className="hidden sm:block w-20 flex-shrink-0">
            <Skeleton className="h-4 w-14 rounded-full ml-auto" />
          </div>
          <Skeleton className="w-3.5 h-3.5 rounded-sm flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Kanban columns. Mirrors TaskBoardView's 288px columns and tinted drop area. */
export function TaskBoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="w-72 flex-shrink-0">
          <div className="flex items-center gap-2 px-1 mb-2">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="space-y-2 min-h-[120px] rounded-2xl p-2 bg-gray-50/60">
            {Array.from({ length: 3 - (col % 2) }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <Skeleton className={`h-3.5 ${titleWidth(col + i)} max-w-full mb-2`} />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12 rounded-full" />
                  <Skeleton className="w-[22px] h-[22px] rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Table rows, including the header, matching TaskTableView's seven columns. */
export function TaskTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="-mx-4 lg:mx-0 bg-white border-y border-gray-100 lg:border lg:rounded-2xl lg:shadow-sm overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[660px] text-sm">
        <thead>
          <tr className="text-left border-b border-gray-100">
            {['Task name', 'Assignee', 'Due date', 'Priority', 'Estimated', 'Logged', 'Brand'].map((h) => (
              <th key={h} className="py-2.5 px-3 first:px-4">
                <span className="text-2xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="py-2.5 px-4">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-[18px] h-[18px] rounded-full flex-shrink-0" />
                  <Skeleton className={`h-3.5 ${titleWidth(i)}`} />
                </div>
              </td>
              <td className="py-2.5 px-3"><Skeleton className="w-5 h-5 rounded-full" /></td>
              <td className="py-2.5 px-3"><Skeleton className="h-4 w-16 rounded-full" /></td>
              <td className="py-2.5 px-3"><Skeleton className="h-5 w-16 rounded-md" /></td>
              <td className="py-2.5 px-3"><Skeleton className="h-3 w-10" /></td>
              <td className="py-2.5 px-3"><Skeleton className="h-3 w-10" /></td>
              <td className="py-2.5 px-3"><Skeleton className="h-3 w-20" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The brand card grid. Mirrors the group heading plus the responsive
 * 1/2/3-column grid the projects page lays out.
 */
export function BrandCardsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline gap-2 px-1 mb-2">
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start gap-2.5 mb-2">
                <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                <Skeleton className={`flex-1 h-3.5 ${titleWidth(i)} max-w-full self-center`} />
                <Skeleton className="h-4 w-14 rounded-full flex-shrink-0 self-center" />
              </div>
              <Skeleton className="h-2.5 w-full mb-1.5" />
              <Skeleton className="h-2.5 w-2/3 mb-2" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Stacked card rows — an icon tile, two lines, a trailing control. Matches the
 * recycle bin, and any list built from the same card row.
 */
export function StackedRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className={`h-3.5 ${titleWidth(i)} max-w-full`} />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Alternating chat bubbles, for a message pane that hasn't loaded yet. */
export function MessageThreadSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex-1 p-6 space-y-3">
      {Array.from({ length: rows }).map((_, i) => {
        const mine = i % 3 === 0
        return (
          <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
              <Skeleton className={`rounded-2xl ${mine ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${i % 2 === 0 ? 'h-10 w-48' : 'h-14 w-64'} max-w-full`} />
              <Skeleton className="h-2 w-10" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
