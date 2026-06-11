'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { deleteFromCloudinary } from '@/utils/fileHelpers'
import type { TaskFile } from '@/types'

export function useTaskFiles(taskId: string | null, enabled = false) {
  const [files,   setFiles]   = useState<TaskFile[]>([])
  const [loading, setLoading] = useState(false)
  const [count,   setCount]   = useState(0)

  const fetchFiles = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    const { data } = await supabase
      .from('task_files')
      .select('*')
      .eq('task_id', taskId)
      .is('parent_file_id', null)
      .order('created_at', { ascending: false })
    setFiles((data as TaskFile[]) || [])
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    if (enabled) void fetchFiles()
  }, [enabled, fetchFiles])

  useEffect(() => {
    if (!taskId) return
    const channelName = `task-files-${taskId}-${Date.now()}`
    let channel: ReturnType<typeof supabase.channel> | undefined
    try {
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'task_files',
          filter: `task_id=eq.${taskId}`,
        }, () => { if (enabled) void fetchFiles() })
        .subscribe()
    } catch {
      // ignore subscription errors in StrictMode double-invoke
    }
    return () => { if (channel) void supabase.removeChannel(channel) }
  }, [taskId, enabled, fetchFiles])

  useEffect(() => {
    if (!taskId) return
    supabase
      .from('task_files')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', taskId)
      .is('parent_file_id', null)
      .then(({ count: n }) => setCount(n || 0))
  }, [taskId, files.length])

  const addFile = useCallback(async (fileData: Omit<TaskFile, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('task_files')
      .insert(fileData)
      .select()
      .single()
    if (!error && data) setFiles((prev) => [data as TaskFile, ...prev])
    return { data: data as TaskFile | null, error }
  }, [])

  const updateStatus = useCallback(async (
    fileId: string,
    status: TaskFile['status'],
    amendmentNotes: string | null = null,
  ) => {
    const update: Partial<TaskFile> = { status }
    if (amendmentNotes !== null) update.amendment_notes = amendmentNotes
    const { data } = await supabase
      .from('task_files')
      .update(update)
      .eq('id', fileId)
      .select()
      .single()
    if (data) setFiles((prev) => prev.map((f) => (f.id === fileId ? (data as TaskFile) : f)))
    return data as TaskFile | null
  }, [])

  const deleteFile = useCallback(async (fileId: string, publicId: string) => {
    await deleteFromCloudinary(publicId)
    await supabase.from('task_files').delete().eq('id', fileId)
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  return { files, loading, count, refetch: fetchFiles, addFile, updateStatus, deleteFile }
}
