'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Flame } from 'lucide-react'
import InsightCard from './InsightCard'
import { accentAlpha, buildHeatmap, formatLongDay, heatLevel } from '@/utils/taskInsights'
import type { DailyPoint, RangeTotals } from '@/types/task-analytics'

interface ActivityMapProps {
  daily: DailyPoint[]
  totals: RangeTotals
  accent: string
}

/** Opacity per step of the scale. Step 0 stays empty — a blank day should read as blank. */
const LEVEL_ALPHA = [0, 0.22, 0.45, 0.7, 1] as const

const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

/**
 * A year of completions as one picture: a column per week, a cell per day, the
 * colour deepening with the count. It answers the question the numbers can't —
 * whether the work is steady or comes in bursts.
 *
 * Wider than a phone by design, so it scrolls inside its own track (starting at
 * today) rather than pushing the page sideways.
 */
export default function ActivityMap({ daily, totals, accent }: ActivityMapProps) {
  const { weeks, months, max } = useMemo(() => buildHeatmap(daily), [daily])
  const [hovered, setHovered] = useState<DailyPoint | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // The recent end is the interesting end, so open there.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeks.length])

  const yearTotal = useMemo(() => daily.reduce((sum, d) => sum + d.completed, 0), [daily])

  return (
    <InsightCard
      title="Activity"
      icon={<CalendarDays size={14} className="text-gray-400" />}
      hint="Every task completed in the last year"
      action={
        <div className="hidden sm:flex items-center gap-1.5 text-3xs text-gray-400">
          Less
          {LEVEL_ALPHA.map((alpha, i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-[3px]"
              style={{ backgroundColor: alpha === 0 ? '#F3F4F6' : accentAlpha(accent, alpha) }}
            />
          ))}
          More
        </div>
      }
    >
      {/* Reading line — holds its height so the grid doesn't jump on hover. */}
      <p className="text-xs2 text-gray-500 mb-3 min-h-[18px]">
        {hovered
          ? <><span className="font-medium text-gray-800 tabular-nums">{hovered.completed} completed</span> · {formatLongDay(hovered.date)}</>
          : <span className="text-gray-400 tabular-nums">{yearTotal} completed in the last year</span>}
      </p>

      <div className="flex gap-2">
        {/* 19px clears the month caption row (15px) plus the 4px column gap. */}
        <div className="flex flex-col gap-[3px] pt-[19px] flex-shrink-0">
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i} className="h-2.5 text-4xs text-gray-300 leading-[10px] w-6">{label}</span>
          ))}
        </div>

        <div ref={scroller} className="flex-1 min-w-0 overflow-x-auto pb-1">
          <div
            role="img"
            aria-label={`Activity map: ${yearTotal} tasks completed over the last year, ${totals.activeDays} active days in the selected period.`}
            className="inline-flex flex-col gap-1"
          >
            <div className="flex gap-[3px] h-[15px]">
              {weeks.map((week, i) => {
                const month = months.find((m) => m.column === i)
                return (
                  <span key={week.key} className="w-2.5 text-4xs text-gray-300 whitespace-nowrap">
                    {month?.label ?? ''}
                  </span>
                )
              })}
            </div>

            <div className="flex gap-[3px]">
              {weeks.map((week) => (
                <div key={week.key} className="flex flex-col gap-[3px]">
                  {week.days.map((day, i) => {
                    if (!day) return <span key={i} className="w-2.5 h-2.5" />
                    const level = heatLevel(day.completed, max)
                    return (
                      <span
                        key={i}
                        onPointerEnter={() => setHovered(day)}
                        onClick={() => setHovered(day)}
                        className="w-2.5 h-2.5 rounded-[3px] transition-colors"
                        style={{ backgroundColor: level === 0 ? '#F3F4F6' : accentAlpha(accent, LEVEL_ALPHA[level]) }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-gray-50">
        <Stat
          label="Current streak"
          value={totals.streak === 0 ? 'None yet' : `${totals.streak} ${totals.streak === 1 ? 'day' : 'days'}`}
          icon={totals.streak >= 2 ? <Flame size={12} className="text-amber-400" /> : null}
        />
        <Stat label="Active days" value={`${totals.activeDays} in this period`} icon={null} />
        <Stat
          label="Busiest day"
          value={totals.best ? `${totals.best.completed} on ${formatLongDay(totals.best.date)}` : 'Nothing yet'}
          icon={null}
        />
      </div>
    </InsightCard>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-3xs text-gray-400">{label}</p>
      <p className="text-xs2 font-medium text-gray-700 flex items-center gap-1 truncate">
        {icon}{value}
      </p>
    </div>
  )
}
