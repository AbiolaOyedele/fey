'use client'

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getContext, setRetentionWeeks, type PipelineContext } from '@/lib/image-pipeline-api'
import type { ChannelAvailability, RetentionWeeks } from '@/types/image-pipeline'

interface ContextState {
  context: PipelineContext | null
  channels: ChannelAvailability[]
  loading: boolean
  /** Re-read balance/tier/admin flags after a charge or admin change. */
  refresh: () => Promise<void>
  /** Persist the user's default image-retention preference. */
  updateRetention: (weeks: RetentionWeeks) => Promise<void>
}

const Ctx = createContext<ContextState | null>(null)

/**
 * Shared Image Pipeline context provider. A single instance backs the corner so
 * the header balance chip and every page read/refresh the SAME state — a charge
 * on the Generate page updates the header immediately. Batch 2 backs the loads
 * with GET routes; the shape is unchanged.
 */
export function PipelineProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<PipelineContext | null>(null)
  const [channels, setChannels] = useState<ChannelAvailability[]>([])
  const [loading, setLoading] = useState(true)

  // One round trip: the context response carries channel availability with it.
  const refresh = useCallback(async () => {
    const ctx = await getContext()
    setContext(ctx)
    setChannels(ctx.channels)
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh() }, [refresh])

  const updateRetention = useCallback(async (weeks: RetentionWeeks) => {
    await setRetentionWeeks(weeks)
    await refresh()
  }, [refresh])

  return createElement(Ctx.Provider, { value: { context, channels, loading, refresh, updateRetention } }, children)
}

/** Reads the shared pipeline context. Must be used within <PipelineProvider>. */
export function useImagePipelineContext(): ContextState {
  const value = useContext(Ctx)
  if (!value) throw new Error('useImagePipelineContext must be used within PipelineProvider')
  return value
}
