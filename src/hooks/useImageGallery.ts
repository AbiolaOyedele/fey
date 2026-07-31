'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { listGenerations, pipelineErrorMessage, retryGeneration } from '@/lib/image-pipeline-api'
import type { IpGeneration } from '@/types/image-pipeline'

interface RetryResult {
  ok: boolean
  message: string
}

interface GalleryState {
  generations: IpGeneration[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  /** Re-attempt a failed run from where it broke (reuses its prompt/preview). */
  retry: (id: string) => Promise<RetryResult>
}

/**
 * Lists the user's generations for the Gallery (finals, pending, rejected,
 * failed). Subscribes to the user's own rows so status changes — a run finishing
 * or a retry progressing — appear live without a manual refresh.
 */
export function useImageGallery(): GalleryState {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [generations, setGenerations] = useState<IpGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const instanceId = useId()

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      setGenerations(await listGenerations())
      setError(null)
    } catch (e) {
      setError(pipelineErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refetch() }, [refetch])

  // Live: any change to the user's own generations refreshes the list.
  useEffect(() => {
    if (!uid) return
    const channel = supabase
      .channel(`ip-gallery-${uid}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ip_generations', filter: `user_id=eq.${uid}` },
        () => { void refetch() },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [uid, refetch, instanceId])

  const retry = useCallback(async (id: string): Promise<RetryResult> => {
    try {
      await retryGeneration(id)
      await refetch()
      return { ok: true, message: 'Retrying — generating your image…' }
    } catch (e) {
      return { ok: false, message: pipelineErrorMessage(e) }
    }
  }, [refetch])

  return { generations, loading, error, refetch, retry }
}
