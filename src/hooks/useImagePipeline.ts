'use client'

import { useCallback, useEffect, useState } from 'react'
import type { IpGeneration } from '@/types/image-pipeline'
import {
  approveGeneration,
  confirmPrompt,
  editPrompt,
  getActiveGeneration,
  pipelineErrorMessage,
  rejectGeneration,
  startGeneration,
  subscribeGeneration,
  type StartGenerationInput,
} from '@/lib/image-pipeline-api'

/** Result of a pipeline action — drives success/failure toasts in the page. */
export interface ActionResult {
  ok: boolean
  message: string | null
}

/**
 * Drives a single generation through the two-gate pipeline and keeps it live
 * over Supabase Realtime. Every action surfaces a plain-English error string
 * rather than throwing at the component.
 *
 * The run itself lives on the server and its AI steps run there, so leaving the
 * page never cancels it: on mount the hook asks for whatever run is still in
 * flight and re-attaches to it, rather than showing an empty form over a
 * generation the user has already paid for.
 */
export function useImagePipeline(onCharged?: () => void) {
  const [generation, setGeneration] = useState<IpGeneration | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(true)

  // Re-attach to a run left in progress (navigated away, reloaded, other tab).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const active = await getActiveGeneration()
        if (!cancelled && active) setGeneration((current) => current ?? active)
      } catch {
        /* resume is best-effort — a fresh run is still startable */
      } finally {
        if (!cancelled) setResuming(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Follow status transitions for the active generation.
  useEffect(() => {
    if (!generation) return
    const unsub = subscribeGeneration(generation.id, (g) => setGeneration(g))
    return unsub
  }, [generation?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(
    async (fn: () => Promise<IpGeneration>): Promise<ActionResult> => {
      setBusy(true)
      setError(null)
      try {
        const g = await fn()
        setGeneration(g)
        onCharged?.()
        return { ok: true, message: null }
      } catch (e) {
        const message = pipelineErrorMessage(e)
        setError(message)
        return { ok: false, message }
      } finally {
        setBusy(false)
      }
    },
    [onCharged],
  )

  const noGen: ActionResult = { ok: false, message: 'Start a generation first.' }

  const start = useCallback(
    (args: StartGenerationInput) => run(() => startGeneration(args)),
    [run],
  )

  const confirm = useCallback((prompt: string) => {
    if (!generation) return Promise.resolve(noGen)
    return run(() => confirmPrompt(generation.id, prompt))
  }, [generation, run]) // eslint-disable-line react-hooks/exhaustive-deps

  const edit = useCallback((prompt: string) => {
    if (!generation) return Promise.resolve(noGen)
    return run(() => editPrompt(generation.id, prompt))
  }, [generation, run]) // eslint-disable-line react-hooks/exhaustive-deps

  const approve = useCallback(() => {
    if (!generation) return Promise.resolve(noGen)
    return run(() => approveGeneration(generation.id))
  }, [generation, run]) // eslint-disable-line react-hooks/exhaustive-deps

  const reject = useCallback(() => {
    if (!generation) return Promise.resolve(noGen)
    return run(() => rejectGeneration(generation.id))
  }, [generation, run]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => { setGeneration(null); setError(null) }, [])

  return { generation, busy, error, resuming, start, confirm, edit, approve, reject, reset }
}
