'use client'

import { useState } from 'react'

export type ViewMode = 'list' | 'grid'

export function useViewMode(key: string, defaultMode: ViewMode = 'list'): [ViewMode, (m: ViewMode) => void] {
  const storageKey = `fey_viewmode_${key}`

  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return defaultMode
    const stored = localStorage.getItem(storageKey)
    return (stored === 'grid' || stored === 'list') ? stored : defaultMode
  })

  const setModeAndStore = (m: ViewMode) => {
    setMode(m)
    try { localStorage.setItem(storageKey, m) } catch { /* quota */ }
  }

  return [mode, setModeAndStore]
}
