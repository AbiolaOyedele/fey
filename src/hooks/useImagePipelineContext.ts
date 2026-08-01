'use client'

import { createContext, createElement, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getContext, setRetentionWeeks, type PipelineContext } from '@/lib/image-pipeline-api'
import type { ChannelAvailability, RetentionWeeks } from '@/types/image-pipeline'

interface ContextState {
  context: PipelineContext | null
  channels: ChannelAvailability[]
  loading: boolean
  /** True when the server refused the module for this account (403). */
  forbidden: boolean
  /** Re-read balance/tier/admin flags after a charge or admin change. */
  refresh: () => Promise<void>
  /** Persist the user's default image-retention preference. */
  updateRetention: (weeks: RetentionWeeks) => Promise<void>
}

const Ctx = createContext<ContextState | null>(null)

/**
 * Shared Image Pipeline context provider. A single instance backs the corner so
 * the header balance chip and every page read/refresh the SAME state — a charge
 * on the Generate page updates the header immediately.
 *
 * A Supabase Realtime subscription on the caller's own credit ledger keeps the
 * balance live: an admin grant, an approved request, or the hourly allocation
 * lands in the header with no manual refresh (the row insert triggers a re-read).
 */
export function PipelineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [context, setContext] = useState<PipelineContext | null>(null)
  const [channels, setChannels] = useState<ChannelAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  // A per-instance channel suffix avoids colliding with any other subscriber.
  const instanceId = useId()

  // One round trip: the context response carries channel availability with it.
  // A rejection here has to be caught: the module is gated server-side, and an
  // uncaught 403 would leave the corner spinning on `loading` forever instead
  // of showing the locked state.
  const refresh = useCallback(async () => {
    try {
      const ctx = await getContext()
      setContext(ctx)
      setChannels(ctx.channels)
      setForbidden(false)
    } catch {
      setForbidden(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh() }, [refresh])

  // Live balance: any new ledger row for this user re-reads the context.
  useEffect(() => {
    if (!uid) return
    const channel = supabase
      .channel(`ip-ledger-${uid}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ip_credit_ledger', filter: `user_id=eq.${uid}` },
        () => { void refresh() },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [uid, refresh, instanceId])

  const updateRetention = useCallback(async (weeks: RetentionWeeks) => {
    await setRetentionWeeks(weeks)
    await refresh()
  }, [refresh])

  return createElement(
    Ctx.Provider,
    { value: { context, channels, loading, forbidden, refresh, updateRetention } },
    children,
  )
}

/** Reads the shared pipeline context. Must be used within <PipelineProvider>. */
export function useImagePipelineContext(): ContextState {
  const value = useContext(Ctx)
  if (!value) throw new Error('useImagePipelineContext must be used within PipelineProvider')
  return value
}
