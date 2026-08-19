import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { createServiceClient } from '@/lib/supabase-server'
import { destroyCloudinaryAssetById, parseCloudinaryUrl } from '@/lib/cloudinary-server'
import { MAX_UPLOAD_BYTES, ALLOWED_UPLOAD_EXTENSIONS, taskDescriptionUploadFolder } from '@/lib/constants'
import { UPLOAD_ROOT_FOLDER } from '@/services/upload.service'
import { extractImageUrls } from '@/utils/imageTokens'
import type { Task, TaskFileRow, TaskScope, TaskHandoff, TaskApprovalState, HandoffKind } from '@/types/work-tasks'
import * as repo from '@/repositories/work-tasks.repository'
import type { StageRules, TaskCore as TaskRow } from '@/repositories/work-tasks.repository'
import * as wfRepo from '@/repositories/workflows.repository'
import { ensureDefaultWorkflow } from '@/services/workflows.service'
import { isWorkspaceAdmin } from '@/lib/owner-context'
import { notify, notifyOwnerAdmins } from '@/services/notifications.service'
import { announceToClient } from '@/services/portal-notifications.service'

/** The bits of a task an announcement needs to reach the right people. */
interface TaskCore {
  id: string
  owner_id: string
  workspace_id: string | null
  contact_id: string | null
}

/**
 * Tells everyone attached to a task what just happened to it.
 *
 * Every task event goes through here, so the two audiences can't drift: the
 * people on the task inside the app (its creator plus every assignee — a change
 * usually matters most to whoever is NOT the one who made it), and the client in
 * their portal when the task is theirs.
 *
 * `recipients` is passed in rather than looked up here because a delete has to
 * collect them before the row goes. Never throws: an announcement failing must
 * not fail the change that triggered it.
 */
async function announceTaskEvent(args: {
  core: TaskCore
  recipients: string[]
  actorId: string
  /** What happened, e.g. 'Task updated'. */
  headline: string
  /** Usually the task title, with a note of what changed. */
  detail: string | null
  /** A deleted task has nothing left to open, so the link stays on the board. */
  gone?: boolean
}): Promise<void> {
  const { core, actorId, headline, detail, gone } = args
  const link = gone ? '/tasks' : `/tasks?taskId=${core.id}`
  try {
    const recipients = args.recipients.filter((id) => id !== actorId)
    if (recipients.length > 0) {
      await notify({
        db: createServiceClient(),
        recipientIds: recipients,
        workspaceId: core.workspace_id,
        actorId,
        type: gone ? 'task_deleted' : 'task_updated',
        title: headline,
        body: detail,
        link,
        entityType: 'task',
        entityId: core.id,
      })
    }
    if (core.contact_id) {
      announceToClient({
        contactId:  core.contact_id,
        ownerId:    core.owner_id,
        type:       'task',
        title:      headline,
        body:       detail,
        link,
        // A deleted task must not resolve to a deep link that 404s, so it
        // carries no entity and falls back to the board.
        entityType: gone ? null : 'task',
        entityId:   gone ? null : core.id,
      })
    }
  } catch { /* best-effort */ }
}

/** Everyone on the task right now: its creator plus every assignee. */
async function participantsOf(taskId: string): Promise<string[]> {
  try {
    return await repo.getTaskParticipants(createServiceClient(), taskId)
  } catch {
    return []
  }
}

/**
 * Tells someone the task is now theirs.
 *
 * Kept separate from the general task announcement because it's the one message
 * that asks for action rather than reporting news — it has to read as "you're
 * up", not as another change notification the recipient can skim past.
 */
async function notifyBatonPassed(
  core: TaskCore,
  toUserId: string | null,
  taskTitle: string,
  stageName: string | null,
  actorId: string,
): Promise<void> {
  if (!toUserId || toUserId === actorId) return
  try {
    await notify({
      db: createServiceClient(),
      recipientIds: [toUserId],
      workspaceId: core.workspace_id,
      actorId,
      type: 'task_assigned',
      title: stageName ? `Over to you — ${stageName}` : 'Over to you',
      body: taskTitle,
      link: `/tasks?taskId=${core.id}`,
      entityType: 'task',
      entityId: core.id,
    })
  } catch { /* best-effort */ }
}

/** Notify newly-added assignees (best-effort; never blocks the task write). */
async function notifyAssigned(
  core: TaskCore,
  addedIds: string[],
  title: string,
  actorId: string,
): Promise<void> {
  const recipients = addedIds.filter((id) => id !== actorId)
  if (recipients.length === 0) return
  try {
    await notify({
      db: createServiceClient(),
      recipientIds: recipients,
      workspaceId: core.workspace_id,
      actorId,
      type: 'task_assigned',
      title: 'New task assigned to you',
      body: title,
      link: `/tasks?taskId=${core.id}`,
      entityType: 'task',
      entityId: core.id,
    })
  } catch { /* best-effort */ }
}

/**
 * Says out loud that a team task was created with nobody on it.
 *
 * Only for team tasks. A personal task with no assignee is just a note to
 * yourself and needs no announcement — but a task put in front of the whole
 * workspace with no name against it is work everyone assumes someone else
 * picked up, which is exactly how it sits untouched for a week.
 *
 * The creator isn't notified: they were there when it happened, and `notify`
 * drops the actor from the recipients anyway.
 */
async function notifyUnassignedTeamTask(
  core: TaskCore,
  title: string,
  actorId: string,
): Promise<void> {
  try {
    await notifyOwnerAdmins(createServiceClient(), core.owner_id, {
      workspaceId: core.workspace_id,
      actorId,
      type: 'task_unassigned',
      title: 'Team task with nobody assigned',
      body: title,
      link: `/tasks?taskId=${core.id}`,
      entityType: 'task',
      entityId: core.id,
    })
  } catch { /* best-effort */ }
}

/** Fields worth telling people about, and how to name them. */
const FIELD_LABELS = {
  title:             'title',
  description:       'description',
  priority:          'priority',
  start_date:        'start date',
  due_date:          'due date',
  estimated_minutes: 'estimate',
} as const

type WatchedField = keyof typeof FIELD_LABELS

/**
 * Which of the watched fields the update actually changes.
 *
 * Compared against the stored row rather than trusting the payload: the drawer
 * saves the whole form, and boards re-send `sort_order` on every drag, so
 * "field present in the request" would fire a notification for nothing.
 */
function changedFields(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): WatchedField[] {
  return (Object.keys(FIELD_LABELS) as WatchedField[])
    .filter((k) => patch[k] !== undefined && (patch[k] ?? null) !== (before[k] ?? null))
}

/** "title and due date" — a change list a person can read. */
function describeChanges(fields: WatchedField[]): string {
  const names = fields.map((f) => FIELD_LABELS[f])
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

interface Ctx {
  userId: string
  ownerId: string
  workspaceId: string | null
}

const prioritySchema = z.enum(['low', 'medium', 'high'])
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.').nullable().optional()

const createSchema = z.object({
  title: z.string().trim().min(1, 'Add a task title.').max(500),
  description: z.string().max(20000).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  visibility: z.enum(['personal', 'team']).optional(),
  stage_id: z.string().uuid().nullable().optional(),
  priority: prioritySchema.optional(),
  start_date: dateSchema,
  due_date: dateSchema,
  estimated_minutes: z.number().int().min(0).nullable().optional(),
  assignee_ids: z.array(z.string().uuid()).optional(),
  responsible_id: z.string().uuid().nullable().optional(),
})

const updateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20000).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  visibility: z.enum(['personal', 'team']).optional(),
  stage_id: z.string().uuid().nullable().optional(),
  priority: prioritySchema.optional(),
  start_date: dateSchema,
  due_date: dateSchema,
  estimated_minutes: z.number().int().min(0).nullable().optional(),
  logged_minutes: z.number().int().min(0).optional(),
  done: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  responsible_id: z.string().uuid().nullable().optional(),
})

const ruleSchema = z.object({
  decision: z.enum(['approved', 'changes_requested']),
  note: z.string().trim().max(2000).nullable().optional(),
})

// ── Responsibility: the baton ────────────────────────────────────────────────
//
// A task sits with exactly one person at a time. Everything below exists so
// that a delay in someone else's stage stops landing on the person who already
// finished their part — the baton moves with the work, and the log records
// every pass so "why was this late" has a real answer.

/** Seconds a task has sat in its current stage, for the handoff log. */
function heldSeconds(enteredAt: string | null): number | null {
  if (!enteredAt) return null
  const ms = Date.now() - new Date(enteredAt).getTime()
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : null
}

/**
 * Who may rule on a gated stage: its named approver, or — when the stage has
 * none, or that person has since left the workspace — anyone who can manage the
 * workspace. The fallback matters: without it a gate could strand a task in a
 * column nobody alive is allowed to open.
 */
async function canRuleOnStage(
  db: SupabaseClient,
  stage: StageRules,
  userId: string,
  ownerId: string,
): Promise<boolean> {
  if (stage.approver_id) return stage.approver_id === userId || await isWorkspaceAdmin(db, userId, ownerId)
  return isWorkspaceAdmin(db, userId, ownerId)
}

/**
 * Refuses to let work leave a gated stage that hasn't been signed off.
 *
 * Enforced here rather than in RLS: expressing "only this stage's approver may
 * change stage_id" as a policy would need a trigger with its own copy of the
 * rules, and two places to keep in step. Every write path into a task goes
 * through this service, so this is the single gate.
 */
async function assertMayLeaveStage(
  db: SupabaseClient,
  existing: TaskRow,
  actorId: string,
): Promise<void> {
  if (!existing.stage_id) return
  const stage = await repo.getStageRules(db, existing.stage_id)
  if (!stage?.requires_approval) return
  // Driven off the stage rather than off `approval_state === 'pending'`: a gate
  // switched on after the fact has to catch the tasks already sitting in that
  // stage, which would otherwise be the only ones able to walk past it.
  if (existing.approval_state === 'approved') return
  if (await canRuleOnStage(db, stage, actorId, existing.owner_id)) return
  throw new AppError(
    403,
    `This task is waiting for sign-off in ${stage.name}. Ask whoever reviews that stage to approve it or send it back.`,
    'TASK_STAGE_AWAITING_APPROVAL',
  )
}

/** The outcome of working out where a task and its baton land after a move. */
interface StagePlan {
  toStage: StageRules | null
  responsibleId: string | null
  approvalState: TaskApprovalState
}

/**
 * Works out who holds the task after it lands in `toStageId`.
 *
 * Precedence is deliberate: an explicit choice by the person moving the task
 * always wins, because they're looking at the work and the rule isn't. Only
 * then does the stage's own rule apply, and a rule that can't be honoured
 * (a `fixed` stage whose owner has left) falls back to leaving the baton where
 * it is rather than dropping it — an unheld task is one nobody is answerable for.
 */
async function planStageMove(
  db: SupabaseClient,
  existing: TaskRow,
  toStageId: string | null,
  explicitResponsible: string | null | undefined,
): Promise<StagePlan> {
  const toStage = toStageId ? await repo.getStageRules(db, toStageId) : null
  const current = existing.responsible_id

  let responsibleId: string | null
  if (explicitResponsible !== undefined) {
    responsibleId = explicitResponsible
  } else if (toStage?.handoff_mode === 'fixed' && toStage.handoff_user_id) {
    responsibleId = toStage.handoff_user_id
  } else {
    // 'keep', 'prompt' with nothing chosen, or a 'fixed' stage with no owner.
    responsibleId = current
  }

  // A gated stage is answered by its approver, so the baton goes to them —
  // otherwise the task would sit "with" someone who isn't allowed to move it.
  if (toStage?.requires_approval && toStage.approver_id && explicitResponsible === undefined) {
    responsibleId = toStage.approver_id
  }

  return {
    toStage,
    responsibleId,
    approvalState: toStage?.requires_approval ? 'pending' : 'none',
  }
}

/**
 * Keeps the desk and the assignee list agreeing.
 *
 * Handing someone the baton puts them on the task. Without this the two can
 * drift apart — a task sitting on Bob's desk while the people "on" it are Ada
 * and Chi — and then every later edit to the assignees has to guess whether
 * Bob's claim outranks theirs. Making the holder an assignee removes the guess:
 * the people on a task are its assignees, and exactly one of them is holding it.
 *
 * Never throws. Someone failing to appear in an avatar list must not roll back
 * the handoff itself.
 */
async function keepHolderOnTask(db: SupabaseClient, taskId: string, holderId: string | null): Promise<void> {
  if (!holderId) return
  try {
    await repo.addAssignee(db, taskId, holderId)
  } catch (err) {
    console.warn('[work-tasks] holder not added to assignees (change saved)', { taskId, err })
  }
}

/** Appends to the chain. Never throws — history must not fail a real move. */
async function recordHandoff(args: {
  db: SupabaseClient
  existing: TaskRow
  toStageId: string | null
  toUserId: string | null
  actorId: string
  kind: HandoffKind
  note?: string | null
}): Promise<void> {
  const { db, existing, toStageId, toUserId, actorId, kind, note } = args
  try {
    await repo.insertHandoff(db, {
      task_id: existing.id,
      owner_id: existing.owner_id,
      from_stage_id: existing.stage_id,
      to_stage_id: toStageId,
      from_user_id: existing.responsible_id,
      to_user_id: toUserId,
      actor_id: actorId,
      kind,
      note: note ?? null,
      held_seconds: heldSeconds(existing.stage_entered_at),
    })
  } catch (err) {
    console.warn('[work-tasks] handoff not recorded (task change saved)', { taskId: existing.id, err })
  }
}

/**
 * Resolves who a task belongs to. project_id wins — a project already implies a
 * client, so contact_id is denormalized from it. A direct contact_id resolves
 * its owner. Otherwise it's a personal task owned by the active workspace owner.
 */
async function resolveLink(
  db: SupabaseClient,
  ctx: Ctx,
  projectId: string | null | undefined,
  contactId: string | null | undefined,
): Promise<{ owner_id: string; workspace_id: string | null; project_id: string | null; contact_id: string | null }> {
  if (projectId) {
    const meta = await repo.getProjectMeta(db, projectId)
    if (!meta) throw new AppError(404, 'That project could not be found.', 'TASK_PROJECT_NOT_FOUND')
    return { owner_id: meta.owner_id, workspace_id: meta.workspace_id, project_id: projectId, contact_id: meta.contact_id }
  }
  if (contactId) {
    const c = await repo.getContactOwner(db, contactId)
    if (!c) throw new AppError(404, 'That client could not be found.', 'TASK_CONTACT_NOT_FOUND')
    return { owner_id: c.owner_id, workspace_id: ctx.workspaceId, project_id: null, contact_id: contactId }
  }
  return { owner_id: ctx.ownerId, workspace_id: ctx.workspaceId, project_id: null, contact_id: null }
}

/** First stage of the relevant workflow, so a new task lands in a board column. */
async function defaultStageId(db: SupabaseClient, ownerId: string, workspaceId: string | null, projectId: string | null): Promise<string | null> {
  let workflowId: string | null = null
  if (projectId) workflowId = await wfRepo.getProjectWorkflowId(db, projectId)
  if (workflowId) {
    const wf = await wfRepo.getWorkflowById(db, workflowId)
    if (wf?.stages.length) return wf.stages[0].id
  }
  const def = await ensureDefaultWorkflow(db, ownerId, workspaceId)
  return def.stages[0]?.id ?? null
}

export async function listTasks(
  db: SupabaseClient,
  ownerId: string,
  opts: {
    scope: TaskScope
    projectId?: string | null
    contactId?: string | null
    done?: boolean
    /** Caller identity + admin flag, for role-scoped visibility on the `all` scope. */
    viewer?: { id: string; isAdmin: boolean }
  },
): Promise<Task[]> {
  return repo.listTasks(db, {
    ownerId,
    scope: opts.scope,
    projectId: opts.projectId ?? null,
    contactId: opts.contactId ?? null,
    ...(opts.done !== undefined ? { done: opts.done } : {}),
    ...(opts.viewer ? { viewer: opts.viewer } : {}),
  })
}

export async function getTask(db: SupabaseClient, id: string): Promise<Task> {
  const task = await repo.getTaskById(db, id)
  if (!task) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  return task
}

export async function createTask(db: SupabaseClient, ctx: Ctx, input: unknown): Promise<Task> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid task.', 'TASK_INVALID')
  const d = parsed.data

  const link = await resolveLink(db, ctx, d.project_id, d.contact_id)
  const stageId = d.stage_id ?? await defaultStageId(db, link.owner_id, link.workspace_id, link.project_id)

  // Linked tasks (client/project) are workspace-visible regardless; for unlinked
  // tasks the caller picks personal vs team. A caller that says nothing gets
  // team, matching what the compose sheet offers — the two defaults have to
  // agree, or a task created through the API lands somewhere its author
  // wouldn't expect from using the app.
  const visibility = (link.project_id || link.contact_id) ? 'team' : (d.visibility ?? 'team')

  // A task starts on someone's desk from the moment it exists: whoever was named,
  // else the first assignee, else the person who raised it. Never nobody —
  // an unheld task is one no one is answerable for, and that's the state this
  // whole feature exists to prevent.
  const responsibleId = d.responsible_id !== undefined
    ? d.responsible_id
    : (d.assignee_ids?.[0] ?? ctx.userId)

  const { id } = await repo.insertTask(db, {
    owner_id: link.owner_id,
    workspace_id: link.workspace_id,
    project_id: link.project_id,
    contact_id: link.contact_id,
    visibility,
    stage_id: stageId,
    responsible_id: responsibleId,
    created_by: ctx.userId,
    title: d.title,
    description: d.description ?? null,
    priority: d.priority ?? 'medium',
    start_date: d.start_date ?? null,
    due_date: d.due_date ?? null,
    estimated_minutes: d.estimated_minutes ?? null,
  })

  const core: TaskCore = { id, owner_id: link.owner_id, workspace_id: link.workspace_id, contact_id: link.contact_id }

  if (d.assignee_ids?.length) {
    await repo.setAssignees(db, id, d.assignee_ids)
    await notifyAssigned(core, d.assignee_ids, d.title, ctx.userId)
  } else if (visibility === 'team' && responsibleId === ctx.userId) {
    // Team-visible, nobody assigned, and not handed to anyone either — the
    // holder defaulted back to whoever typed it. Handing it over deliberately
    // sends the baton message below instead, so this can't double up.
    await notifyUnassignedTeamTask(core, d.title, ctx.userId)
  }

  // Raising a task straight onto someone else's desk has to reach them. The
  // assignee notification above doesn't cover it: the holder needn't be an
  // assignee at all, and even when they are, "assigned to you" and "it's your
  // turn" are different messages.
  if (responsibleId && responsibleId !== ctx.userId && !d.assignee_ids?.includes(responsibleId)) {
    await notifyBatonPassed(core, responsibleId, d.title, null, ctx.userId)
  }

  // Client-linked tasks are visible in the portal, so the client should hear
  // about them the same way they hear about a file or a contract.
  if (link.contact_id) {
    announceToClient({
      contactId: link.contact_id,
      ownerId:   link.owner_id,
      type:      'task',
      title:     'New task added',
      body:      d.title,
      link:      `/tasks?taskId=${id}`,
      entityType: 'task',
      entityId:   id,
    })
  }

  return getTask(db, id)
}

export async function updateTask(db: SupabaseClient, ctx: Ctx, id: string, input: unknown): Promise<Task> {
  const existing = await repo.getTaskCore(db, id)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid update.', 'TASK_INVALID')
  const d = parsed.data

  const updates: Record<string, unknown> = {}
  if (d.title !== undefined) updates.title = d.title
  if (d.description !== undefined) updates.description = d.description
  if (d.visibility !== undefined) updates.visibility = d.visibility
  if (d.stage_id !== undefined) updates.stage_id = d.stage_id
  if (d.priority !== undefined) updates.priority = d.priority
  if (d.start_date !== undefined) updates.start_date = d.start_date
  if (d.due_date !== undefined) updates.due_date = d.due_date
  if (d.estimated_minutes !== undefined) updates.estimated_minutes = d.estimated_minutes
  if (d.logged_minutes !== undefined) updates.logged_minutes = d.logged_minutes
  if (d.sort_order !== undefined) updates.sort_order = d.sort_order
  if (d.done !== undefined) {
    updates.done = d.done
    updates.completed_at = d.done ? new Date().toISOString() : null
  }

  // ── The baton ──────────────────────────────────────────────────────────────
  // Two ways responsibility changes: the task moves stage (the common case), or
  // someone reassigns it where it stands. Completing a task is also a way of
  // leaving a stage, so it's gated the same way — otherwise "mark done" would be
  // a one-click bypass of every approval in the workflow.
  const movingStage = d.stage_id !== undefined && d.stage_id !== existing.stage_id
  const completing = d.done === true && !existing.done
  if (movingStage || completing) await assertMayLeaveStage(db, existing, ctx.userId)

  let plan: StagePlan | null = null
  if (movingStage) {
    plan = await planStageMove(db, existing, d.stage_id ?? null, d.responsible_id)
    updates.responsible_id = plan.responsibleId
    updates.approval_state = plan.approvalState
  } else if (d.responsible_id !== undefined && d.responsible_id !== existing.responsible_id) {
    updates.responsible_id = d.responsible_id
  }

  // Re-linking a task re-derives owner/workspace/contact from the new target.
  if (d.project_id !== undefined || d.contact_id !== undefined) {
    const link = await resolveLink(db, ctx, d.project_id ?? existing.project_id, d.contact_id ?? existing.contact_id)
    updates.project_id = link.project_id
    updates.contact_id = link.contact_id
    updates.owner_id = link.owner_id
    updates.workspace_id = link.workspace_id
  }

  await repo.updateTaskRow(db, id, updates)
  if (updates.responsible_id !== undefined) {
    await keepHolderOnTask(db, id, updates.responsible_id as string | null)
  }
  if (d.description !== undefined) await cleanupRemovedDescriptionImages(id, existing.description, d.description)

  const core: TaskCore = {
    id,
    owner_id:     existing.owner_id,
    workspace_id: existing.workspace_id,
    contact_id:   (updates.contact_id as string | null | undefined) ?? existing.contact_id,
  }
  const taskTitle = d.title ?? existing.title

  // Every change on a task reaches everyone on it. The three are separated
  // because they read differently to the person receiving them: a stage move
  // says where the work is now, completion says it's finished, and an edit says
  // the brief moved under your feet. One event fires per save — a save that
  // both moves the stage and edits the title announces the move, since that's
  // the larger fact.
  // Recipients are collected AFTER the write so the person who just picked up
  // the baton is included — they're the one who most needs to hear about it.
  const recipients = await participantsOf(id)
  const completed  = d.done === true && !existing.done
  const reopened   = d.done === false && existing.done
  const edits      = changedFields(existing as unknown as Record<string, unknown>, d as Record<string, unknown>)

  if (movingStage && plan) {
    const handedOver = plan.responsibleId !== existing.responsible_id
    await recordHandoff({
      db, existing,
      toStageId: d.stage_id ?? null,
      toUserId: plan.responsibleId,
      actorId: ctx.userId,
      kind: 'moved',
    })
    const stageName = plan.toStage?.name ?? null
    if (handedOver) await notifyBatonPassed(core, plan.responsibleId, taskTitle, stageName, ctx.userId)
    if (stageName) {
      // A gated stage says so plainly — "moved to Review" and "waiting on
      // Review" are different facts to everyone watching the task.
      const headline = plan.approvalState === 'pending'
        ? `Waiting for sign-off in ${stageName}`
        : `Moved to ${stageName}`
      await announceTaskEvent({ core, recipients, actorId: ctx.userId, headline, detail: taskTitle })
    }
  } else if (updates.responsible_id !== undefined) {
    await recordHandoff({
      db, existing,
      toStageId: existing.stage_id,
      toUserId: (updates.responsible_id as string | null),
      actorId: ctx.userId,
      kind: 'reassigned',
    })
    await notifyBatonPassed(core, updates.responsible_id as string | null, taskTitle, null, ctx.userId)
  } else if (completed) {
    await announceTaskEvent({ core, recipients, actorId: ctx.userId, headline: 'Task completed', detail: taskTitle })
  } else if (reopened) {
    await announceTaskEvent({ core, recipients, actorId: ctx.userId, headline: 'Task reopened', detail: taskTitle })
  } else if (edits.length > 0) {
    await announceTaskEvent({
      core, recipients, actorId: ctx.userId,
      headline: 'Task updated',
      detail: `${taskTitle} — ${describeChanges(edits)} changed`,
    })
  }

  return getTask(db, id)
}

/**
 * Images pasted into a description are stored as hosted URLs inside the text,
 * so editing one out is the only "delete" a user gets — this drops the matching
 * Cloudinary asset. Scoped to this task's own description folder, so a URL
 * pasted in from an attachment or another task is never destroyed. Best-effort:
 * the text is the source of truth, cleanup never fails the update.
 */
async function cleanupRemovedDescriptionImages(
  taskId: string,
  before: string | null,
  after: string | null,
): Promise<void> {
  if (!before) return
  const kept = new Set(extractImageUrls(after ?? ''))
  const removed = extractImageUrls(before).filter((url) => !kept.has(url))
  const prefix = `${UPLOAD_ROOT_FOLDER}/${taskDescriptionUploadFolder(taskId)}/`
  for (const url of removed) {
    const parsed = parseCloudinaryUrl(url)
    if (!parsed?.publicId.startsWith(prefix)) continue
    const cleaned = await destroyCloudinaryAssetById(parsed.publicId, parsed.resourceType)
    if (!cleaned) console.warn('[updateTask] description image cleanup failed (description saved)', { taskId })
  }
}

/**
 * Removes a task and tells everyone who was on it.
 *
 * Participants are collected BEFORE the delete: afterwards the assignee rows
 * are still there, but reading them post-hoc would be luck rather than intent.
 * `actorId` is optional so older callers keep working — without it the deleter
 * is notified too, which is worse than a missing name but not wrong.
 */
export async function deleteTask(db: SupabaseClient, id: string, actorId?: string): Promise<void> {
  const existing = await repo.getTaskCore(db, id)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  const recipients = await participantsOf(id)
  await repo.softDeleteTask(db, id)
  await announceTaskEvent({
    core: { id, owner_id: existing.owner_id, workspace_id: existing.workspace_id, contact_id: existing.contact_id },
    recipients,
    actorId: actorId ?? '',
    headline: 'Task deleted',
    detail: existing.title,
    gone: true,
  })
}

export async function setAssignees(db: SupabaseClient, taskId: string, userIds: string[], actorId: string): Promise<Task> {
  const existing = await repo.getTaskCore(db, taskId)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  const prev = await repo.getAssigneeIds(db, taskId)
  await repo.setAssignees(db, taskId, userIds)
  const added   = userIds.filter((id) => !prev.includes(id))
  const removed = prev.filter((id) => !userIds.includes(id))

  // Assigning someone hands them the task.
  //
  // The baton follows the assignee list: whoever holds it keeps it while they're
  // still on the task, and otherwise the first assignee picks it up. That's what
  // makes "assign it to Ada" put the work on Ada's desk rather than leaving it
  // on yours with her name attached to it.
  //
  // The previous rule also required the holder to have BEEN an assignee before
  // (`removed.includes(...)`), which is precisely the case that never holds. A
  // task starts on its creator's desk without the creator being assigned to it,
  // so on the first assignment there was nothing to remove and the baton never
  // moved. Handing work over left it exactly where it was.
  //
  // An empty list can't take the baton — an unheld task is one nobody is
  // answerable for, and the holder stays until there's someone to pass it to.
  const holderStillOn = existing.responsible_id !== null && userIds.includes(existing.responsible_id)
  const nextHolder = holderStillOn ? existing.responsible_id : (userIds[0] ?? existing.responsible_id)
  const batonMoved = nextHolder !== existing.responsible_id

  if (batonMoved) {
    await repo.updateTaskRow(db, taskId, { responsible_id: nextHolder })
    await recordHandoff({
      db,
      existing,
      toStageId: existing.stage_id,
      toUserId: nextHolder,
      actorId,
      kind: 'reassigned',
    })
  }

  const task = await repo.getTaskById(db, taskId)
  const taskTitle = task?.title ?? existing.title ?? 'A task'

  if (added.length) {
    await notifyAssigned(existing, added, taskTitle, actorId)
  }
  // Only when they weren't just told. Someone newly assigned already has a
  // message saying so; a second one saying the same task is on their desk is
  // the same fact twice. Someone already on the task who has just picked up the
  // baton has heard nothing yet, and it's theirs now.
  if (batonMoved && nextHolder !== null && !added.includes(nextHolder)) {
    await notifyBatonPassed(existing, nextHolder, taskTitle, null, actorId)
  }
  // Everyone still on the task hears that the line-up changed — including the
  // people taken off it, who otherwise find out by the task quietly vanishing.
  if (added.length || removed.length) {
    await announceTaskEvent({
      core: existing,
      recipients: [...new Set([...prev, ...userIds])].filter((id) => !added.includes(id)),
      actorId,
      headline: 'Task assignees changed',
      detail: existing.title,
    })
  }
  return getTask(db, taskId)
}

// ── Approval gates ────────────────────────────────────────────────────────────

/**
 * Rules on a task sitting in a gated stage.
 *
 * Approving advances it to the next stage — or completes it, if the gate is the
 * last stage on the board. Requesting changes sends it back to where it came
 * from AND returns the baton to whoever handed it over, which is the part that
 * makes the chain run both ways: without it, rework would land on the reviewer
 * or on the stage's standing owner rather than on the person who did the work.
 */
export async function ruleOnTask(
  db: SupabaseClient,
  ctx: Ctx,
  id: string,
  input: unknown,
): Promise<Task> {
  const existing = await repo.getTaskCore(db, id)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')

  const parsed = ruleSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid decision.', 'TASK_RULING_INVALID')
  const { decision, note } = parsed.data

  const stage = existing.stage_id ? await repo.getStageRules(db, existing.stage_id) : null
  if (!stage?.requires_approval) {
    throw new AppError(409, 'This task isn’t waiting for approval.', 'TASK_RULING_NOT_GATED')
  }
  if (existing.approval_state === 'approved') {
    throw new AppError(409, 'This task has already been approved.', 'TASK_RULING_ALREADY_DECIDED')
  }
  if (existing.done) {
    throw new AppError(409, 'This task is already complete.', 'TASK_RULING_ALREADY_DONE')
  }
  if (!(await canRuleOnStage(db, stage, ctx.userId, existing.owner_id))) {
    throw new AppError(403, `Only the person who reviews ${stage.name} can approve this or send it back.`, 'TASK_RULING_FORBIDDEN')
  }

  // Who handed the work into this gate. They own the outcome either way: they
  // pick it back up on rework, and they carry it onward when it's approved —
  // the approver was only ever holding it long enough to rule.
  const last = await repo.getLastHandoff(db, id)
  const submitter = last?.from_user_id ?? existing.created_by

  const updates: Record<string, unknown> = { approval_state: decision }
  let toStage: StageRules | null = null
  let toUser: string | null = submitter
  let headline: string

  if (decision === 'approved') {
    toStage = await repo.getAdjacentStage(db, stage, 1)
    if (toStage) {
      updates.stage_id = toStage.id
      if (toStage.handoff_mode === 'fixed' && toStage.handoff_user_id) toUser = toStage.handoff_user_id
      if (toStage.requires_approval) {
        // Straight into the next gate — one approval shouldn't clear two.
        updates.approval_state = 'pending'
        if (toStage.approver_id) toUser = toStage.approver_id
      }
      headline = `Approved — moved to ${toStage.name}`
    } else {
      // Approving the last stage on the board is what finishing looks like.
      updates.done = true
      updates.completed_at = new Date().toISOString()
      headline = 'Approved and completed'
    }
  } else {
    // Back to where it came from. The recorded origin beats "one stage left":
    // a task dragged in from three columns over should go back to those three
    // columns over, not shuffle back one.
    const backTo = last?.from_stage_id
      ? await repo.getStageRules(db, last.from_stage_id)
      : await repo.getAdjacentStage(db, stage, -1)
    if (backTo) {
      toStage = backTo
      updates.stage_id = backTo.id
    }
    headline = toStage ? `Changes requested — back to ${toStage.name}` : 'Changes requested'
  }

  updates.responsible_id = toUser
  await repo.updateTaskRow(db, id, updates)
  await keepHolderOnTask(db, id, toUser)

  await recordHandoff({
    db, existing,
    toStageId: (updates.stage_id as string | undefined) ?? existing.stage_id,
    toUserId: toUser,
    actorId: ctx.userId,
    kind: decision,
    note: note ?? null,
  })

  const core: TaskCore = {
    id, owner_id: existing.owner_id, workspace_id: existing.workspace_id, contact_id: existing.contact_id,
  }
  const recipients = await participantsOf(id)
  await announceTaskEvent({
    core, recipients, actorId: ctx.userId,
    headline,
    detail: note ? `${existing.title} — ${note}` : existing.title,
  })
  await notifyBatonPassed(core, toUser, existing.title, toStage?.name ?? null, ctx.userId)

  return getTask(db, id)
}

/** The full chain of hands a task has passed through, newest first. */
export async function listTaskHandoffs(db: SupabaseClient, taskId: string): Promise<TaskHandoff[]> {
  const existing = await repo.getTaskCore(db, taskId)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  return repo.listHandoffs(db, taskId, existing.owner_id)
}

// ── Files ─────────────────────────────────────────────────────────────────────

const fileSchema = z.object({
  file_name: z.string().trim().min(1, 'File name is required.').max(300),
  // Uploads go direct to Cloudinary; the metadata row must point back at it.
  file_url: z.string().url().startsWith('https://res.cloudinary.com/', 'Invalid file URL.'),
  public_id: z.string().min(1).max(300),
  file_size: z.number().int().min(0).max(MAX_UPLOAD_BYTES, 'File is too large.').nullable().optional(),
  file_type: z.string().max(100).nullable().optional(),
})

/** Records a Cloudinary upload against a task. The binary is already uploaded
 *  client-side (signed); this validates + stores the metadata row. */
export async function addTaskFile(
  db: SupabaseClient,
  taskId: string,
  input: unknown,
  actor: { userId: string; name: string | null },
): Promise<TaskFileRow> {
  const existing = await repo.getTaskCore(db, taskId)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')

  const parsed = fileSchema.safeParse(input)
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid file.', 'TASK_FILE_INVALID')
  const d = parsed.data

  // Defense in depth: re-check the extension server-side (SECURITY.md) — the
  // client validates before uploading, but the metadata write must not trust it.
  const ext = d.file_name.split('.').pop()?.toLowerCase() ?? ''
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppError(422, 'That file type is not allowed.', 'TASK_FILE_INVALID_TYPE')
  }

  return repo.insertTaskFile(db, {
    task_id: taskId,
    owner_id: existing.owner_id,
    uploaded_by: actor.userId,
    uploader_name: actor.name,
    file_name: d.file_name,
    file_url: d.file_url,
    public_id: d.public_id,
    file_size: d.file_size ?? null,
    file_type: d.file_type ?? null,
  })
}

/** Deletes a file's metadata row, then best-effort removes the Cloudinary
 *  asset server-side. The resource type (image/video/raw) is parsed from the
 *  delivery URL; the exact stored public_id is used so raw files (which keep
 *  their extension in the public_id) delete correctly. */
export async function deleteTaskFile(db: SupabaseClient, taskId: string, fileId: string): Promise<void> {
  const file = await repo.getTaskFile(db, fileId)
  if (!file || file.task_id !== taskId) throw new AppError(404, 'That file could not be found.', 'TASK_FILE_NOT_FOUND')
  await repo.deleteTaskFileRow(db, fileId)

  const resourceType = parseCloudinaryUrl(file.file_url)?.resourceType ?? 'image'
  const cleaned = await destroyCloudinaryAssetById(file.public_id, resourceType)
  if (!cleaned) console.warn('[deleteTaskFile] Cloudinary cleanup failed (metadata removed)', { fileId })
}

// ── Subtasks ──────────────────────────────────────────────────────────────────

export async function addSubtask(db: SupabaseClient, taskId: string, title: string, sortOrder: number) {
  const existing = await repo.getTaskCore(db, taskId)
  if (!existing) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  const trimmed = title.trim()
  if (!trimmed) throw new AppError(400, 'Add a subtask title.', 'SUBTASK_INVALID')
  return repo.insertSubtask(db, { task_id: taskId, title: trimmed.slice(0, 500), sort_order: sortOrder })
}

export async function updateSubtask(db: SupabaseClient, id: string, updates: { title?: string; done?: boolean; sort_order?: number }) {
  const parent = await repo.getSubtaskParent(db, id)
  if (!parent) throw new AppError(404, 'That subtask could not be found.', 'SUBTASK_NOT_FOUND')
  if (updates.title !== undefined) {
    const trimmed = updates.title.trim()
    if (!trimmed) throw new AppError(400, 'Subtask title cannot be empty.', 'SUBTASK_INVALID')
    updates = { ...updates, title: trimmed.slice(0, 500) }
  }
  await repo.updateSubtaskRow(db, id, updates)
}

export async function deleteSubtask(db: SupabaseClient, id: string) {
  const parent = await repo.getSubtaskParent(db, id)
  if (!parent) throw new AppError(404, 'That subtask could not be found.', 'SUBTASK_NOT_FOUND')
  await repo.deleteSubtaskRow(db, id)
}
