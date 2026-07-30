'use client'

import { useCallback, useEffect, useState } from 'react'
import { listGenerations, pipelineErrorMessage } from '@/lib/image-pipeline-api'
import type { IpGeneration } from '@/types/image-pipeline'

interface GalleryState {
  generations: IpGeneration[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/** Lists the user's generations for the Gallery (finals, pending, rejected). */
export function useImageGallery(): GalleryState {
  const [generations, setGenerations] = useState<IpGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return { generations, loading, error, refetch }
}
