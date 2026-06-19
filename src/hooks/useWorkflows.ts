'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { Workflow } from '@/types/work-tasks'

/**
 * Loads the workspace's workflows (creating the default on first use, server-side).
 * Used by the board (stage columns) and the workflow settings UI.
 */
export function useWorkflows(workspaceId: string | null | undefined) {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const qs = workspaceId ? `?workspace_id=${workspaceId}` : ''

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const { workflows } = await apiFetch<{ workflows: Workflow[] }>(`/api/v1/workflows${qs}`)
      setWorkflows(workflows)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [qs])

  useEffect(() => { void refetch() }, [refetch])

  const createWorkflow = useCallback(async (name: string) => {
    await apiFetch('/api/v1/workflows', { method: 'POST', body: JSON.stringify({ name, workspace_id: workspaceId }) })
    await refetch()
  }, [workspaceId, refetch])

  const renameWorkflow = useCallback(async (id: string, name: string) => {
    await apiFetch(`/api/v1/workflows/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
    await refetch()
  }, [refetch])

  const addStage = useCallback(async (workflowId: string, name: string, color: string, sortOrder: number) => {
    await apiFetch(`/api/v1/workflows/${workflowId}`, { method: 'POST', body: JSON.stringify({ name, color, sort_order: sortOrder }) })
    await refetch()
  }, [refetch])

  const updateStage = useCallback(async (id: string, updates: { name?: string; color?: string; sort_order?: number }) => {
    await apiFetch(`/api/v1/workflow-stages/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    await refetch()
  }, [refetch])

  const deleteStage = useCallback(async (id: string) => {
    await apiFetch(`/api/v1/workflow-stages/${id}`, { method: 'DELETE' })
    await refetch()
  }, [refetch])

  const applyToProject = useCallback(async (workflowId: string, projectId: string) => {
    await apiFetch(`/api/v1/workflows/${workflowId}/apply`, { method: 'POST', body: JSON.stringify({ project_id: projectId }) })
  }, [])

  return { workflows, loading, error, refetch, createWorkflow, renameWorkflow, addStage, updateStage, deleteStage, applyToProject }
}
