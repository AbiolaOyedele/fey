'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api-client'
import { uploadToCloudinary } from '@/utils/cloudinary'
import type { Watermark } from '@/types/ruffTool'

/**
 * Saved watermark library for the Watermarker tool. Binaries go to Cloudinary
 * (signed upload); the metadata row is stored via /api/v1/ruff/watermarks so
 * the library syncs across the workspace and devices.
 */
export function useWatermarks(workspaceId: string | null | undefined) {
  const [watermarks, setWatermarks] = useState<Watermark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const q = workspaceId ? `?workspace_id=${workspaceId}` : ''
      const { watermarks } = await apiFetch<{ watermarks: Watermark[] }>(`/api/v1/ruff/watermarks${q}`)
      setWatermarks(watermarks)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load saved watermarks')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  // Initial + workspace-change fetch. refetch flips loading state synchronously;
  // that's the intended data-hook pattern (mirrors useSocialPlanner).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refetch() }, [refetch])

  /** Uploads the image to Cloudinary, then saves the metadata row. */
  const saveWatermark = useCallback(async (file: File, name: string): Promise<Watermark> => {
    const uploaded = await uploadToCloudinary(file, 'ruff/watermarks').promise
    const dims = await imageDims(file)
    const { watermark } = await apiFetch<{ watermark: Watermark }>('/api/v1/ruff/watermarks', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim() || 'Watermark',
        image_url: uploaded.url,
        public_id: uploaded.publicId,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        workspace_id: workspaceId,
      }),
    })
    setWatermarks((prev) => [watermark, ...prev])
    return watermark
  }, [workspaceId])

  const removeWatermark = useCallback(async (id: string): Promise<void> => {
    setWatermarks((prev) => prev.filter((w) => w.id !== id))
    try {
      await apiFetch(`/api/v1/ruff/watermarks/${id}`, { method: 'DELETE' })
    } catch (e) {
      void refetch() // reconcile on failure
      throw e
    }
  }, [refetch])

  return { watermarks, loading, error, refetch, saveWatermark, removeWatermark }
}

/** Reads the natural pixel dimensions of an image File. */
function imageDims(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}
