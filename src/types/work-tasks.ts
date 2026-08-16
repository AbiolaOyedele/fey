// Unified task system (work_tasks). See supabase/migrations/20260619_work_tasks.sql.
// A task is "personal" when both project_id and contact_id are null (private to
// creator + assignees), otherwise "linked" (workspace + client/portal visible).

export type TaskPriority = 'low' | 'medium' | 'high'

/** For unlinked tasks: 'personal' = creator+assignees only; 'team' = whole workspace. */
export type TaskVisibility = 'personal' | 'team'

/**
 * Who picks up the baton when a task enters a stage.
 * - `keep`   — whoever holds it stays on it (the default; nothing changes hands)
 * - `fixed`  — always the stage's standing owner (`handoff_user_id`)
 * - `prompt` — whoever moves the task chooses, at the moment of the move
 */
export type StageHandoffMode = 'keep' | 'fixed' | 'prompt'

/** Where a task stands against a gated stage. `none` = no gate in play. */
export type TaskApprovalState = 'none' | 'pending' | 'approved' | 'changes_requested'

/** How a pass of the baton came about. */
export type HandoffKind = 'moved' | 'approved' | 'changes_requested' | 'reassigned'

export interface WorkflowStage {
  id: string
  workflow_id: string
  name: string
  color: string
  sort_order: number
  handoff_mode: StageHandoffMode
  /** The standing owner, for `fixed`. Null degrades the stage to `keep`. */
  handoff_user_id: string | null
  /** When true, work can't leave this stage until it's signed off. */
  requires_approval: boolean
  /** Who may rule here. Null falls back to anyone who can manage the workspace. */
  approver_id: string | null
  /** How long work should sit here before it counts as stalled. */
  target_days: number | null
}

export interface Workflow {
  id: string
  owner_id: string
  workspace_id: string | null
  name: string
  is_default: boolean
  stages: WorkflowStage[]
}

export interface TaskAssignee {
  user_id: string
  name: string | null
  email: string | null
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  done: boolean
  sort_order: number
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
  edited_at: string | null
}

/**
 * One pass of the baton — recorded on every stage move and every ruling.
 *
 * Stage names and holder names are denormalized onto the row when it's read
 * back, because the point of the log is to survive a stage being renamed or a
 * teammate leaving.
 */
export interface TaskHandoff {
  id: string
  task_id: string
  from_stage_id: string | null
  to_stage_id: string | null
  from_user_id: string | null
  to_user_id: string | null
  actor_id: string | null
  kind: HandoffKind
  note: string | null
  /** Seconds the task sat in `from_stage` before this pass. */
  held_seconds: number | null
  created_at: string
  // Resolved for display:
  from_stage_name: string | null
  to_stage_name: string | null
  from_user_name: string | null
  to_user_name: string | null
  actor_name: string | null
}

/** A Cloudinary-backed file attached to a task (metadata row; binary lives in Cloudinary). */
export interface TaskFileRow {
  id: string
  file_name: string
  file_url: string
  public_id: string
  file_size: number | null
  file_type: string | null
  uploader_name: string | null
  created_at: string
}

export interface Task {
  id: string
  owner_id: string
  workspace_id: string | null
  project_id: string | null
  contact_id: string | null
  stage_id: string | null
  created_by: string
  /**
   * Set when a client raised this task from their portal. Portal users aren't
   * auth users, so `created_by` is the workspace owner — this is the real
   * requester, and the only tasks a client may edit or remove themselves.
   */
  requested_by_portal_user: string | null
  visibility: TaskVisibility
  /**
   * The one person the task sits with right now. Assignees are the cast;
   * this is who is answerable today — and the only person it counts as
   * overdue for. Null means nobody has picked it up.
   */
  responsible_id: string | null
  /** When it entered its current stage. The stage clock starts here. */
  stage_entered_at: string
  approval_state: TaskApprovalState
  title: string
  description: string | null
  priority: TaskPriority
  start_date: string | null
  due_date: string | null
  estimated_minutes: number | null
  logged_minutes: number
  sort_order: number
  done: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
  // Joined / derived (populated by the list query, not columns):
  assignees: TaskAssignee[]
  /** `responsible_id` resolved to a name. Null when nobody holds it. */
  responsible: TaskAssignee | null
  subtasks: Subtask[]
  files: TaskFileRow[]
  project_title: string | null
  contact_name: string | null
  /** Set when this task was created from a Social Corner post — links back to the calendar. */
  social_post: { id: string; scheduled_date: string } | null
}

// ── API payloads ────────────────────────────────────────────────────────────

export interface CreateTaskPayload {
  title: string
  description?: string | null
  project_id?: string | null
  contact_id?: string | null
  visibility?: TaskVisibility
  stage_id?: string | null
  priority?: TaskPriority
  start_date?: string | null
  due_date?: string | null
  estimated_minutes?: number | null
  assignee_ids?: string[]
  /** Who starts with the baton. Defaults to the first assignee, else the creator. */
  responsible_id?: string | null
}

export interface UpdateTaskPayload {
  title?: string
  description?: string | null
  project_id?: string | null
  contact_id?: string | null
  visibility?: TaskVisibility
  stage_id?: string | null
  priority?: TaskPriority
  start_date?: string | null
  due_date?: string | null
  estimated_minutes?: number | null
  logged_minutes?: number
  done?: boolean
  sort_order?: number
  /**
   * Hands the baton on. Sent alongside `stage_id` when the target stage prompts
   * for a holder; sent alone to reassign responsibility without moving the task.
   */
  responsible_id?: string | null
}

/** Which slice of tasks a list request wants. */
export type TaskScope = 'personal' | 'team' | 'all' | 'project' | 'contact'

// ── Stage configuration ─────────────────────────────────────────────────────

export interface UpdateStagePayload {
  name?: string
  color?: string
  sort_order?: number
  handoff_mode?: StageHandoffMode
  handoff_user_id?: string | null
  requires_approval?: boolean
  approver_id?: string | null
  target_days?: number | null
}

// ── Approval ────────────────────────────────────────────────────────────────

export interface RuleOnTaskPayload {
  decision: 'approved' | 'changes_requested'
  note?: string | null
}

// ── Derived helpers (pure — safe on both sides of the wire) ──────────────────

/** Whether this stage stops work from leaving until someone signs off. */
export function isGated(stage: WorkflowStage | null | undefined): boolean {
  return stage?.requires_approval === true
}

/**
 * Whether this task is currently held up waiting for sign-off.
 *
 * Keyed on the stage's rule and the absence of an approval — NOT on
 * `approval_state === 'pending'` alone. Turning a gate on affects the tasks
 * already sitting in that stage, which would otherwise be the one set of tasks
 * that could walk straight past it. `approved` is the only state that clears
 * the gate; `changes_requested` doesn't, because that ruling sent the task back
 * out and anything returning has to be looked at again.
 */
export function needsSignOff(
  task: Pick<Task, 'approval_state' | 'done'>,
  stage: WorkflowStage | null | undefined,
): boolean {
  if (!stage?.requires_approval || task.done) return false
  return task.approval_state !== 'approved'
}

/** Whether `userId` may approve or send back work sitting in `stage`. */
export function canRule(
  stage: WorkflowStage | null | undefined,
  userId: string | null,
  canManageWorkspace: boolean,
): boolean {
  if (!stage) return false
  // No named approver — or one who has since left — falls back to workspace
  // managers, so a gate can never strand work with nobody able to open it.
  if (!stage.approver_id) return canManageWorkspace
  return stage.approver_id === userId || canManageWorkspace
}

/**
 * Whether a task is sitting longer in its stage than that stage allows.
 *
 * This is the fair measure of lateness: it asks how long the CURRENT holder has
 * had it, not whether a task-level due date — which a whole chain of people
 * share — has passed. A stage with no target never goes stale.
 */
export function isStale(task: Task, stage: WorkflowStage | null | undefined, now: Date = new Date()): boolean {
  if (task.done || !stage?.target_days) return false
  const entered = new Date(task.stage_entered_at).getTime()
  if (Number.isNaN(entered)) return false
  return now.getTime() - entered > stage.target_days * 86_400_000
}

/** Whole days the task has sat in its current stage. */
export function daysInStage(task: Task, now: Date = new Date()): number {
  const entered = new Date(task.stage_entered_at).getTime()
  if (Number.isNaN(entered)) return 0
  return Math.max(0, Math.floor((now.getTime() - entered) / 86_400_000))
}
