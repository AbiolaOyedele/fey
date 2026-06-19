import type { SupabaseClient } from '@supabase/supabase-js'
import type { Workflow, WorkflowStage } from '@/types/work-tasks'

/**
 * Workflow + stage queries. All queries for the task-workflow domain live here.
 * Callers pass a user-scoped client (RLS enforced) for owner actions.
 */

interface RawWorkflow {
  id: string
  owner_id: string
  workspace_id: string | null
  name: string
  is_default: boolean
  workflow_stages: WorkflowStage[] | null
}

function mapWorkflow(row: RawWorkflow): Workflow {
  return {
    id: row.id,
    owner_id: row.owner_id,
    workspace_id: row.workspace_id,
    name: row.name,
    is_default: row.is_default,
    stages: (row.workflow_stages ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }
}

export async function listWorkflows(db: SupabaseClient, ownerId: string): Promise<Workflow[]> {
  const { data, error } = await db
    .from('workflows')
    .select('id, owner_id, workspace_id, name, is_default, workflow_stages ( id, workflow_id, name, color, sort_order )')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as RawWorkflow[]).map(mapWorkflow)
}

export async function getWorkflowById(db: SupabaseClient, id: string): Promise<Workflow | null> {
  const { data, error } = await db
    .from('workflows')
    .select('id, owner_id, workspace_id, name, is_default, workflow_stages ( id, workflow_id, name, color, sort_order )')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data ? mapWorkflow(data as RawWorkflow) : null
}

export async function getDefaultWorkflow(
  db: SupabaseClient,
  ownerId: string,
  workspaceId: string | null,
): Promise<Workflow | null> {
  let q = db
    .from('workflows')
    .select('id, owner_id, workspace_id, name, is_default, workflow_stages ( id, workflow_id, name, color, sort_order )')
    .eq('owner_id', ownerId)
    .eq('is_default', true)
    .is('deleted_at', null)
  q = workspaceId ? q.eq('workspace_id', workspaceId) : q.is('workspace_id', null)
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  return data ? mapWorkflow(data as RawWorkflow) : null
}

export async function insertWorkflow(
  db: SupabaseClient,
  row: { owner_id: string; workspace_id: string | null; name: string; is_default: boolean },
): Promise<{ id: string }> {
  const { data, error } = await db.from('workflows').insert(row).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function insertStages(
  db: SupabaseClient,
  workflowId: string,
  stages: Array<{ name: string; color: string; sort_order: number }>,
): Promise<void> {
  if (stages.length === 0) return
  const { error } = await db
    .from('workflow_stages')
    .insert(stages.map((s) => ({ ...s, workflow_id: workflowId })))
  if (error) throw error
}

export async function updateWorkflow(
  db: SupabaseClient,
  id: string,
  updates: { name?: string },
): Promise<void> {
  const { error } = await db.from('workflows').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function insertStage(
  db: SupabaseClient,
  row: { workflow_id: string; name: string; color: string; sort_order: number },
): Promise<WorkflowStage> {
  const { data, error } = await db.from('workflow_stages').insert(row).select('*').single()
  if (error) throw error
  return data as WorkflowStage
}

export async function updateStage(
  db: SupabaseClient,
  id: string,
  updates: { name?: string; color?: string; sort_order?: number },
): Promise<void> {
  const { error } = await db.from('workflow_stages').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteStage(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('workflow_stages').delete().eq('id', id)
  if (error) throw error
}

/** Points a project at a workflow (NULL = use workspace default). */
export async function setProjectWorkflow(db: SupabaseClient, projectId: string, workflowId: string | null): Promise<void> {
  const { error } = await db.from('projects').update({ workflow_id: workflowId }).eq('id', projectId)
  if (error) throw error
}

export async function getProjectWorkflowId(db: SupabaseClient, projectId: string): Promise<string | null> {
  const { data, error } = await db.from('projects').select('workflow_id').eq('id', projectId).maybeSingle()
  if (error) throw error
  return (data as { workflow_id: string | null } | null)?.workflow_id ?? null
}
