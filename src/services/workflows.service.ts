import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import type { Workflow, WorkflowStage } from '@/types/work-tasks'
import * as repo from '@/repositories/workflows.repository'

/** Seeded on first use. Order matters — the first stage is the default column. */
export const DEFAULT_STAGES: ReadonlyArray<{ name: string; color: string }> = [
  { name: 'Backlog',     color: '#94A3B8' },
  { name: 'In Progress', color: '#3B82F6' },
  { name: 'Review',      color: '#F59E0B' },
  { name: 'Done',        color: '#22C55E' },
]

/**
 * Returns the workspace's default workflow, creating it (named "Default" with
 * the four seed stages) the first time it's needed. Safe under concurrency: if
 * the unique index rejects a second insert, we re-read the winner.
 */
export async function ensureDefaultWorkflow(
  db: SupabaseClient,
  ownerId: string,
  workspaceId: string | null,
): Promise<Workflow> {
  const existing = await repo.getDefaultWorkflow(db, ownerId, workspaceId)
  if (existing) return existing
  try {
    const { id } = await repo.insertWorkflow(db, { owner_id: ownerId, workspace_id: workspaceId, name: 'Default', is_default: true })
    await repo.insertStages(db, id, DEFAULT_STAGES.map((s, i) => ({ name: s.name, color: s.color, sort_order: i })))
    const created = await repo.getWorkflowById(db, id)
    if (created) return created
  } catch {
    /* unique violation — another request created it; fall through to re-read */
  }
  const winner = await repo.getDefaultWorkflow(db, ownerId, workspaceId)
  if (!winner) throw new AppError(500, 'Could not set up the task board. Please try again.', 'WORKFLOW_SEED_FAILED')
  return winner
}

export async function listWorkflows(db: SupabaseClient, ownerId: string, workspaceId: string | null): Promise<Workflow[]> {
  await ensureDefaultWorkflow(db, ownerId, workspaceId)
  return repo.listWorkflows(db, ownerId)
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Give the workflow a name.').max(100),
  stages: z.array(z.object({ name: z.string().trim().min(1).max(50), color: z.string().min(1) })).min(1).optional(),
})

export async function createWorkflow(
  db: SupabaseClient,
  ctx: { ownerId: string; workspaceId: string | null },
  input: unknown,
): Promise<Workflow> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid workflow.', 'WORKFLOW_INVALID')
  const stages = parsed.data.stages ?? DEFAULT_STAGES.map((s) => ({ name: s.name, color: s.color }))
  const { id } = await repo.insertWorkflow(db, { owner_id: ctx.ownerId, workspace_id: ctx.workspaceId, name: parsed.data.name, is_default: false })
  await repo.insertStages(db, id, stages.map((s, i) => ({ name: s.name, color: s.color, sort_order: i })))
  const created = await repo.getWorkflowById(db, id)
  if (!created) throw new AppError(500, 'Could not create the workflow.', 'WORKFLOW_CREATE_FAILED')
  return created
}

export async function renameWorkflow(db: SupabaseClient, id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new AppError(400, 'Give the workflow a name.', 'WORKFLOW_INVALID')
  await repo.updateWorkflow(db, id, { name: trimmed.slice(0, 100) })
}

export async function addStage(db: SupabaseClient, workflowId: string, name: string, color: string, sortOrder: number): Promise<WorkflowStage> {
  if (!name.trim()) throw new AppError(400, 'Give the stage a name.', 'STAGE_INVALID')
  return repo.insertStage(db, { workflow_id: workflowId, name: name.trim().slice(0, 50), color, sort_order: sortOrder })
}

export async function updateStage(db: SupabaseClient, id: string, updates: { name?: string; color?: string; sort_order?: number }): Promise<void> {
  await repo.updateStage(db, id, updates)
}

export async function deleteStage(db: SupabaseClient, id: string): Promise<void> {
  await repo.deleteStage(db, id)
}

export async function applyWorkflowToProject(db: SupabaseClient, projectId: string, workflowId: string | null): Promise<void> {
  await repo.setProjectWorkflow(db, projectId, workflowId)
}
