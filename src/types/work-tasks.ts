// Unified task system (work_tasks). See supabase/migrations/20260619_work_tasks.sql.
// A task is "personal" when both project_id and contact_id are null (private to
// creator + assignees), otherwise "linked" (workspace + client/portal visible).

export type TaskPriority = 'low' | 'medium' | 'high'

/** For unlinked tasks: 'personal' = creator+assignees only; 'team' = whole workspace. */
export type TaskVisibility = 'personal' | 'team'

export interface WorkflowStage {
  id: string
  workflow_id: string
  name: string
  color: string
  sort_order: number
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
  visibility: TaskVisibility
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
}

/** Which slice of tasks a list request wants. */
export type TaskScope = 'personal' | 'team' | 'all' | 'project' | 'contact'
