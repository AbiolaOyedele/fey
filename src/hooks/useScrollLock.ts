'use client'

import { useEffect } from 'react'

// Nested/stacked overlays share one lock — we only touch the body when the
// count crosses 0↔1, and restore the exact scroll position on full release.
let lockCount = 0
let savedScrollY = 0

function lock() {
  lockCount += 1
  if (lockCount > 1) return
  savedScrollY = window.scrollY
  const { body, documentElement: html } = document
  // position:fixed is the only technique that reliably stops background scroll
  // on iOS Safari (overflow:hidden alone doesn't). Offset by the current scroll
  // so the page doesn't visually jump to the top while locked.
  body.style.position = 'fixed'
  body.style.top = `-${savedScrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  // Signals to usePullToRefresh that a popup owns the touch surface right now.
  html.setAttribute('data-scroll-locked', '')
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return
  const { body, documentElement: html } = document
  body.style.position = ''
  body.style.top = ''
  body.style.left = ''
  body.style.right = ''
  body.style.width = ''
  html.removeAttribute('data-scroll-locked')
  window.scrollTo(0, savedScrollY)
}

/**
 * Locks background page scroll while `active` (default true), so an open popup
 * on mobile can be scrolled without the page behind it scrolling, stealing the
 * touch, or bouncing. Reference-counted, so stacked popups behave, and the
 * scroll position is restored exactly on close.
 */
export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    lock()
    return unlock
  }, [active])
}
