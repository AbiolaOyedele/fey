'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { deleteFromCloudinary } from '@/utils/fileHelpers'
import type { TaskFile } from '@/types'

export interface ClientFile {
  id: string
  client_id: string
  campaign_id: string | null
  uploaded_by: string | null
  uploader_name: string
  file_name: string
  file_url: string
  public_id: string
  file_size: number
  file_type: string
  version: number
  status: 'pending' | 'approved' | 'declined' | 'amended'
  amendment_notes: string | null
  parent_file_id: string | null
  created_at: string
  _source: 'client'
}

export type AnyFile = (ClientFile) | (TaskFile & { _source: 'task' })

interface UseClientFilesOptions {
  campaignId?: string
}

interface UseClientFilesReturn {
  files: AnyFile[]
  loading: boolean
  refetch: () => Promise<void>
  addClientFile: (fileData: Omit<ClientFile, 'id' | 'created_at' | '_source'>) => Promise<{ data: ClientFile | null; error: unknown }>
  updateStatus: (fileId: string, source: 'client' | 'task', status: ClientFile['status'], amendmentNotes?: string | null) => Promise<AnyFile | null>
  deleteFile: (fileId: string, publicId: string, source: 'client' | 'task') => Promise<void>
  fetchVersions: (fileId: string, source: 'client' | 'task') => Promise<AnyFile[]>
}

/**
 * Manages files for a client OR a campaign.
 *
 * useClientFiles(clientId)              → client-level files (campaign_id IS NULL) + task files
 * useClientFiles(clientId, {campaignId}) → campaign-scoped files only (campaign_id = campaignId)
 */
export function useClientFiles(
  clientId: string | null,
  { campaignId }: UseClientFilesOptions = {},
): UseClientFilesReturn {
  const [files, setFiles] = useState<AnyFile[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!clientId) return
    setLoading(true)

    if (campaignId) {
      // Campaign-scoped: only client_files with matching campaign_id
      const { data } = await supabase
        .from('client_files')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
      setFiles(((data ?? []) as Omit<ClientFile, '_source'>[]).map((f) => ({ ...f, _source: 'client' as const })))
    } else {
      // Client-level: client_files where campaign_id IS NULL + all task_files
      const [cf, tf] = await Promise.all([
        supabase
          .from('client_files')
          .select('*')
          .eq('client_id', clientId)
          .is('campaign_id', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('task_files')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ])

      const combined: AnyFile[] = [
        ...((cf.data ?? []) as Omit<ClientFile, '_source'>[]).map((f) => ({ ...f, _source: 'client' as const })),
        ...((tf.data ?? []) as Omit<TaskFile, '_source'>[]).map((f) => ({ ...f, _source: 'task' as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setFiles(combined)
    }
    setLoading(false)
  }, [clientId, campaignId])

  useEffect(() => { void fetch() }, [fetch])

  // Realtime: listen to relevant table(s)
  useEffect(() => {
    if (!clientId) return
    const channelName = `client-all-files-${clientId}-${campaignId ?? 'base'}-${Date.now()}`
    let channel: ReturnType<typeof supabase.channel> | undefined
    try {
      const builder = supabase.channel(channelName)

      if (campaignId) {
        builder.on(
          'postgres_changes' as Parameters<typeof builder.on>[0],
          {
            event: '*',
            schema: 'public',
            table: 'client_files',
            filter: `campaign_id=eq.${campaignId}`,
          },
          () => void fetch(),
        )
      } else {
        builder
          .on(
            'postgres_changes' as Parameters<typeof builder.on>[0],
            {
              event: '*',
              schema: 'public',
              table: 'client_files',
              filter: `client_id=eq.${clientId}`,
            },
            () => void fetch(),
          )
          .on(
            'postgres_changes' as Parameters<typeof builder.on>[0],
            {
              event: '*',
              schema: 'public',
              table: 'task_files',
              filter: `client_id=eq.${clientId}`,
            },
            () => void fetch(),
          )
      }

      channel = builder.subscribe()
    } catch {
      // ignore StrictMode double-invoke errors
    }
    return () => { if (channel) void supabase.removeChannel(channel) }
  }, [clientId, campaignId, fetch])

  const addClientFile = useCallback(async (
    fileData: Omit<ClientFile, 'id' | 'created_at' | '_source'>,
  ) => {
    const { data, error } = await supabase
      .from('client_files')
      .insert(fileData)
      .select()
      .single()
    if (!error && data) void fetch()
    return { data: data as ClientFile | null, error }
  }, [fetch])

  const updateStatus = useCallback(async (
    fileId: string,
    source: 'client' | 'task',
    status: ClientFile['status'],
    amendmentNotes: string | null = null,
  ) => {
    const table = source === 'task' ? 'task_files' : 'client_files'
    const update: { status: ClientFile['status']; amendment_notes?: string | null } = { status }
    if (amendmentNotes !== null) update.amendment_notes = amendmentNotes
    const { data } = await supabase
      .from(table)
      .update(update)
      .eq('id', fileId)
      .select()
      .single()
    if (data) {
      const updated = { ...(data as object), _source: source } as AnyFile
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)))
      return updated
    }
    return null
  }, [])

  const deleteFile = useCallback(async (
    fileId: string,
    publicId: string,
    source: 'client' | 'task',
  ) => {
    await deleteFromCloudinary(publicId)
    const table = source === 'task' ? 'task_files' : 'client_files'
    await supabase.from(table).delete().eq('id', fileId)
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const fetchVersions = useCallback(async (
    fileId: string,
    source: 'client' | 'task',
  ): Promise<AnyFile[]> => {
    const table = source === 'task' ? 'task_files' : 'client_files'
    const { data } = await supabase
      .from(table)
      .select('*')
      .or(`id.eq.${fileId},parent_file_id.eq.${fileId}`)
      .order('version', { ascending: true })
    return ((data ?? []) as Omit<AnyFile, '_source'>[]).map((f) => ({
      ...f,
      _source: source,
    })) as AnyFile[]
  }, [])

  return {
    files,
    loading,
    refetch: fetch,
    addClientFile,
    updateStatus,
    deleteFile,
    fetchVersions,
  }
}
