'use client'

import { useCallback, useState } from 'react'
import { z } from 'zod'
import type { QrStyle, QrStyleValues } from '@/types/ruffTool'

const STORAGE_KEY = 'fey_ruff_qr_styles'
const MAX_STYLES = 24

/** Saved styles are device-local, so anything read back is untrusted input. */
const styleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  dark: z.string().min(1),
  light: z.string().min(1),
  dot: z.enum(['square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded']),
  eye: z.enum(['square', 'dot', 'extra-rounded']),
  pupil: z.enum(['square', 'dot']),
  margin: z.number().min(0).max(200),
  ecc: z.enum(['L', 'M', 'Q', 'H']),
})

function read(): QrStyle[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = z.array(styleSchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return [] // unreadable or malformed — start clean rather than throwing
  }
}

function write(styles: QrStyle[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(styles))
  } catch { /* private mode or quota — the session still works, just isn't saved */ }
}

export interface QrStylesApi {
  styles: QrStyle[]
  saveStyle: (name: string, values: QrStyleValues) => QrStyle
  removeStyle: (id: string) => void
}

/**
 * The QR Generator's saved-style shelf. Styles live in localStorage on this
 * device — no server round-trip, nothing leaves the browser. Saving a name that
 * already exists overwrites that style rather than adding a duplicate.
 */
export function useQrStyles(): QrStylesApi {
  const [styles, setStyles] = useState<QrStyle[]>(read)

  const saveStyle = useCallback((name: string, values: QrStyleValues): QrStyle => {
    const clean = name.trim().slice(0, 40) || 'My style'
    const style: QrStyle = { ...values, id: crypto.randomUUID(), name: clean }
    setStyles((prev) => {
      const next = [style, ...prev.filter((s) => s.name.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_STYLES)
      write(next)
      return next
    })
    return style
  }, [])

  const removeStyle = useCallback((id: string): void => {
    setStyles((prev) => {
      const next = prev.filter((s) => s.id !== id)
      write(next)
      return next
    })
  }, [])

  return { styles, saveStyle, removeStyle }
}
