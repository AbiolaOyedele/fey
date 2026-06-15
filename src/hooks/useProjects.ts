'use client'

/**
 * useProjects / useProject — direct Supabase hooks for the Projects feature,
 * mirroring the useCrm pattern (RLS enforces owner_id = auth.uid()).
 *
 * A project is a per-client container with its own message thread and files.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getEffectiveOwnerId, getActiveWorkspaceId } from '@/lib/active-workspace'
import type {
  Project, ProjectMessage, ProjectFile,
  CreateProjectPayload, UpdateProjectPayload,
} from '@/types/project'
import type { MessageAttachment } from '@/types/crm'

// ── useProjects (list for a client) ───────────────────────────────────────────

export function useProjects(contactId: string | null) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    if (!contactId) { setProjects([]); setLoading(false); return }
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('projects')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
      if (err) throw err
      setProjects((data ?? []) as Project[])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => { void fetchProjects() }, [fetchProjects])

  const createProject = useCallback(async (payload: CreateProjectPayload) => {
    const { data, error: err } = await supabase
      .from('projects')
      .insert({
        ...payload,
        owner_id: await getEffectiveOwnerId(),
        workspace_id: await getActiveWorkspaceId(),
      })
      .select()
      .single()
    if (err) throw err
    const project = data as Project
    setProjects((prev) => [project, ...prev])
    return project
  }, [])

  const updateProject = useCallback(async (id: string, payload: UpdateProjectPayload) => {
    const { data, error: err } = await supabase
      .from('projects')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const project = data as Project
    setProjects((prev) => prev.map((p) => p.id === id ? project : p))
    return project
  }, [])

  const archiveProject = useCallback(async (id: string, archived: boolean) => {
    const archived_at = archived ? new Date().toISOString() : null
    const { error: err } = await supabase
      .from('projects')
      .update({ archived_at, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, archived_at } : p))
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('projects').delete().eq('id', id)
    if (err) throw err
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { projects, loading, error, fetchProjects, createProject, updateProject, archiveProject, deleteProject }
}

// ── useProject (single project: details + messages + files) ───────────────────

export function useProject(projectId: string | null) {
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [{ data: p }, { data: m }, { data: f }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_messages').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
        supabase.from('project_files').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      ])
      if (p) setProject(p as Project)
      setMessages((m ?? []) as ProjectMessage[])
      setFiles((f ?? []) as ProjectFile[])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const sendMessage = useCallback(async (body: string, bodyHtml: string, attachments: MessageAttachment[]) => {
    if (!projectId) return
    const ownerId = await getEffectiveOwnerId()
    const { data, error: err } = await supabase
      .from('project_messages')
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        workspace_id: await getActiveWorkspaceId(),
        sender_type: 'owner',
        sender_id: ownerId,
        body,
        body_html: bodyHtml,
        attachments,
      })
      .select()
      .single()
    if (err) throw err
    setMessages((prev) => [...prev, data as ProjectMessage])
  }, [projectId])

  const addFile = useCallback(async (file: { file_name: string; file_url: string; public_id?: string | null; file_size?: number | null; file_type?: string | null }) => {
    if (!projectId) return
    const { data, error: err } = await supabase
      .from('project_files')
      .insert({
        project_id: projectId,
        owner_id: await getEffectiveOwnerId(),
        workspace_id: await getActiveWorkspaceId(),
        uploader_type: 'owner',
        file_name: file.file_name,
        file_url: file.file_url,
        public_id: file.public_id ?? null,
        file_size: file.file_size ?? null,
        file_type: file.file_type ?? null,
      })
      .select()
      .single()
    if (err) throw err
    setFiles((prev) => [data as ProjectFile, ...prev])
  }, [projectId])

  const removeFile = useCallback(async (fileId: string) => {
    const { error: err } = await supabase.from('project_files').delete().eq('id', fileId)
    if (err) throw err
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  return { project, messages, files, loading, reload: load, sendMessage, addFile, removeFile }
}
