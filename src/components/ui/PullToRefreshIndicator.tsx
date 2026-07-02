'use client'

import { RefreshCw } from 'lucide-react'
import { PULL_THRESHOLD } from '@/hooks/usePullToRefresh'

interface PullToRefreshIndicatorProps {
  pullDistance: number
  refreshing: boolean
  accent: string
}

/** Small floating spinner that tracks a pull-to-refresh gesture in progress. */
export default function PullToRefreshIndicator({ pullDistance, refreshing, accent }: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !refreshing) return null

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)
  const offset = refreshing ? 20 : Math.min(pullDistance, PULL_THRESHOLD) - 28

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[70] flex justify-center pointer-events-none"
      style={{ transform: `translateY(${offset}px)`, opacity: refreshing ? 1 : progress }}
    >
      <div className="w-8 h-8 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center mt-2">
        <RefreshCw
          size={15}
          className={refreshing ? 'animate-spin' : ''}
          style={{ color: accent, transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }}
        />
      </div>
    </div>
  )
}
