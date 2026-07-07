'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { SocialPostFile } from '@/types/social'

/** Attachments for a single post — loaded lazily once the post exists and the
 *  attachments section is open. */
export function useSocialPostFiles(postId: string | null, enabled: boolean) {
  const [files, setFiles] = useState<SocialPostFile[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    try {
      const { files: f } = await apiFetch<{ files: SocialPostFile[] }>(`/api/v1/social/posts/${postId}/files`)
      setFiles(f)
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    if (enabled && postId) void refetch()
    if (!postId) setFiles([])
  }, [enabled, postId, refetch])

  const addFile = useCallback(async (
    id: string,
    payload: { file_name: string; file_url: string; public_id: string; file_size?: number | null; file_type?: string | null },
  ) => {
    const { file } = await apiFetch<{ file: SocialPostFile }>(`/api/v1/social/posts/${id}/files`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setFiles((prev) => [file, ...prev])
    return file
  }, [])

  const removeFile = useCallback(async (id: string, fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    await apiFetch(`/api/v1/social/posts/${id}/files/${fileId}`, { method: 'DELETE' })
  }, [])

  return { files, loading, refetch, addFile, removeFile }
}
