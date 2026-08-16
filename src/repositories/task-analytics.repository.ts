import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskPriority } from '@/types/work-tasks'

/**
 * The one query behind the task insights panel.
 *
 * Deliberately leaner than the list query in work-tasks.repository — no
 * subtasks, files or comments — because insights only needs the timing, the
 * link (brand/client) and who was on it. Callers pass a user-scoped client so
 * RLS decides what is visible before any of it is counted.
 */

export interface AnalyticsTaskRow {
  id: string
  project_id: string | null
  contact_id: string | null
  created_by: string
  /** Who holds the task right now. Open/overdue counts attribute here. */
  responsible_id: string | null
  priority: TaskPriority
  due_date: string | null
  done: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
  project_title: string | null
  contact_name: string | null
  assignee_ids: string[]
}

interface RawRow {
  id: string
  project_id: string | null
  contact_id: string | null
  created_by: string
  responsible_id: string | null
  priority: TaskPriority
  due_date: string | null
  done: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
  work_task_assignees: Array<{ user_id: string }> | null
  projects: { title: string } | { title: string }[] | null
  crm_contacts: { name: string } | { name: string }[] | null
}

const SELECT = `
  id, project_id, contact_id, created_by, responsible_id, priority, due_date, done,
  completed_at, created_at, updated_at,
  work_task_assignees ( user_id ),
  projects:project_id ( title ),
  crm_contacts:contact_id ( name )
`

/**
 * Upper bound on rows pulled into one insights request. Well above what a
 * workspace realistically has in a year; it exists so a runaway account can
 * never turn this into an unbounded read.
 */
const MAX_ROWS = 5000

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export interface AnalyticsQuery {
  ownerId: string
  /** ISO timestamp — tasks created or completed on/after this are in scope. */
  since: string
  projectId?: string | null
  contactId?: string | null
  assigneeId?: string | null
}


/**
 * Every task that either moved inside the window or is still open.
 *
 * Open tasks come back regardless of age because the panel reports the current
 * backlog ("open now", "overdue now") alongside what happened in the window —
 * a task raised two years ago and still not done belongs in that count.
 */
export async function listTasksForAnalytics(
  db: SupabaseClient,
  args: AnalyticsQuery,
): Promise<AnalyticsTaskRow[]> {
  let q = db
    .from('work_tasks')
    .select(SELECT)
    .eq('owner_id', args.ownerId)
    .is('deleted_at', null)
    .or(`done.eq.false,created_at.gte.${args.since},completed_at.gte.${args.since}`)

  if (args.projectId) q = q.eq('project_id', args.projectId)
  if (args.contactId) q = q.eq('contact_id', args.contactId)
  // Narrowing to a person means the work sitting with them, matching what the
  // people breakdown counts — otherwise clicking a row showing "3 open" would
  // open a list of every task they've ever been assigned to.
  if (args.assigneeId) q = q.eq('responsible_id', args.assigneeId)

  const { data, error } = await q.order('created_at', { ascending: false }).limit(MAX_ROWS)
  if (error) throw error

  return ((data ?? []) as RawRow[]).map((r) => ({
    id: r.id,
    project_id: r.project_id,
    contact_id: r.contact_id,
    created_by: r.created_by,
    responsible_id: r.responsible_id ?? null,
    priority: r.priority,
    due_date: r.due_date,
    done: r.done,
    completed_at: r.completed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    project_title: one(r.projects)?.title ?? null,
    contact_name: one(r.crm_contacts)?.name ?? null,
    assignee_ids: (r.work_task_assignees ?? []).map((a) => a.user_id),
  }))
}
