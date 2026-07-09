'use client'

import { useEffect, useRef, useState } from 'react'

/** Pixels of pull distance required to trigger a refresh on release. */
export const PULL_THRESHOLD = 70
const MAX_PULL = 120

/**
 * Native-app-style pull-to-refresh: on touch devices, pulling down while the
 * page is scrolled to the top past PULL_THRESHOLD and releasing calls
 * onRefresh. No-ops on non-touch devices (desktop). Tracks window scroll —
 * pages with their own internal scroll pane (e.g. Playground) aren't covered.
 */
export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const distanceRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return

    const onTouchStart = (e: TouchEvent) => {
      // Don't hijack the gesture when a popup owns the touch surface (see
      // useScrollLock) — otherwise pulling down inside a modal blocks its own
      // scroll or triggers a page refresh.
      if (document.documentElement.hasAttribute('data-scroll-locked')) { startY.current = null; return }
      if (window.scrollY > 0 || refreshingRef.current) { startY.current = null; return }
      startY.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0 || window.scrollY > 0) {
        startY.current = null
        distanceRef.current = 0
        setPullDistance(0)
        return
      }
      // Past this point we're confidently pulling down from the top —
      // prevent the browser's own overscroll/refresh from also firing.
      e.preventDefault()
      const next = Math.min(delta * 0.5, MAX_PULL)
      distanceRef.current = next
      setPullDistance(next)
    }

    const onTouchEnd = () => {
      if (startY.current === null) return
      startY.current = null
      if (distanceRef.current >= PULL_THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        void Promise.resolve(onRefresh()).finally(() => {
          refreshingRef.current = false
          setRefreshing(false)
          distanceRef.current = 0
          setPullDistance(0)
        })
      } else {
        distanceRef.current = 0
        setPullDistance(0)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onRefresh])

  return { pullDistance, refreshing }
}
