'use client'

import { useState, useCallback, useEffect } from 'react'
import { imageFromPaste } from '@/utils/ruffImage'

export type ToastTone = 'success' | 'error'

export interface ToastState {
  message: string
  tone: ToastTone
  /** Bumped on every call so repeating the same action re-announces it. */
  id: number
}

export interface ToastApi {
  toast: ToastState | null
  /** Confirms an action worked. */
  success: (message: string) => void
  /** Reports an action that failed, in plain English. */
  error: (message: string) => void
  clear: () => void
}

/**
 * Transient success/failure feedback for a single tool. Every action a user
 * takes — export, copy, generate, save, delete — ends in one of these so the
 * outcome is never left to guesswork.
 */
export function useToast(): ToastApi {
  const [toast, setToast] = useState<ToastState | null>(null)
  const push = useCallback((message: string, tone: ToastTone) => {
    setToast((prev) => ({ message, tone, id: (prev?.id ?? 0) + 1 }))
  }, [])
  const success = useCallback((message: string) => push(message, 'success'), [push])
  const error = useCallback((message: string) => push(message, 'error'), [push])
  const clear = useCallback(() => setToast(null), [])
  return { toast, success, error, clear }
}

/** Calls `onImage(file)` whenever the user pastes an image while enabled. */
export function usePaste(onImage: (file: File) => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: ClipboardEvent) => {
      const file = imageFromPaste(e)
      if (file) onImage(file)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [onImage, enabled])
}
