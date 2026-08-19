import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import type { TaskComment } from '@/types/work-tasks'
import * as taskRepo from '@/repositories/work-tasks.repository'
import * as repo from '@/repositories/task-comments.repository'
import { notify } from '@/services/notifications.service'
import { announceToClient } from '@/services/portal-notifications.service'

export async function listComments(db: SupabaseClient, taskId: string): Promise<TaskComment[]> {
  const task = await taskRepo.getTaskCore(db, taskId)
  if (!task) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')
  return repo.listComments(db, taskId)
}

export async function addComment(db: SupabaseClient, taskId: string, authorId: string, body: unknown): Promise<TaskComment> {
  const task = await taskRepo.getTaskCore(db, taskId)
  if (!task) throw new AppError(404, 'That task could not be found.', 'TASK_NOT_FOUND')

  const trimmed = typeof body === 'string' ? body.trim() : ''
  if (!trimmed) throw new AppError(400, 'Write a comment before posting.', 'COMMENT_INVALID')
  if (trimmed.length > 10000) throw new AppError(400, 'That comment is too long.', 'COMMENT_INVALID')

  return repo.insertComment(db, { task_id: taskId, author_id: authorId, body: trimmed })
}

export async function updateComment(db: SupabaseClient, id: string, actorId: string, body: unknown): Promise<TaskComment> {
  const existing = await repo.getCommentById(db, id)
  if (!existing) throw new AppError(404, 'That comment could not be found.', 'COMMENT_NOT_FOUND')
  if (existing.author_id !== actorId) throw new AppError(403, 'You can only edit your own comments.', 'COMMENT_FORBIDDEN')

  const trimmed = typeof body === 'string' ? body.trim() : ''
  if (!trimmed) throw new AppError(400, 'A comment cannot be empty.', 'COMMENT_INVALID')
  if (trimmed.length > 10000) throw new AppError(400, 'That comment is too long.', 'COMMENT_INVALID')

  return repo.updateCommentRow(db, id, trimmed)
}

export async function deleteComment(db: SupabaseClient, id: string, actorId: string): Promise<void> {
  const existing = await repo.getCommentById(db, id)
  if (!existing) throw new AppError(404, 'That comment could not be found.', 'COMMENT_NOT_FOUND')
  if (existing.author_id !== actorId) throw new AppError(403, 'You can only delete your own comments.', 'COMMENT_FORBIDDEN')
  await repo.deleteCommentRow(db, id)
}

interface NotifyCommentArgs {
  /** Caller-scoped client — reads the task + assignees under RLS. */
  userDb: SupabaseClient
  /** Service-role client — writes notifications for other users. */
  serviceDb: SupabaseClient
  taskId: string
  actorId: string
  actorName: string | null
  /** Users already @mentioned in this comment — they get the more specific
   *  mention notification instead, so they're excluded here to avoid double-notifying. */
  excludeUserIds: string[]
}

/**
 * Notifies everyone involved in a task — its assignees plus its creator — that
 * a new comment was posted (in-app + web push). The actor and any already-
 * @mentioned users are excluded. Best-effort: never throws, so a notification
 * failure can't break posting the comment.
 */
export async function notifyCommentParticipants(args: NotifyCommentArgs): Promise<void> {
  try {
    const task = await taskRepo.getTaskCore(args.userDb, args.taskId)
    if (!task) return

    const assigneeIds = await taskRepo.getAssigneeIds(args.userDb, args.taskId)
    const exclude = new Set([args.actorId, ...args.excludeUserIds])
    // The holder included: they're the one answerable for this task right now,
    // which makes them the most likely person a comment is actually addressed
    // to — and they aren't necessarily an assignee or the creator.
    const recipients = [...new Set([...assigneeIds, task.created_by, task.responsible_id])]
      .filter((id): id is string => !!id && !exclude.has(id))

    const link = task.contact_id
      ? `/clients/${task.contact_id}/tasks?taskId=${args.taskId}`
      : `/tasks?taskId=${args.taskId}`

    // The client hears about it too, when the task is theirs. They can see and
    // reply to this thread now, so a reply they're never told about is the same
    // as no reply — and this is the agency talking, which is exactly the sort of
    // thing a client is waiting on.
    if (task.contact_id) {
      announceToClient({
        contactId: task.contact_id,
        ownerId: task.owner_id,
        // 'task' is the client's category — their preferences are per-section,
        // so a comment is gated by the same "tasks" flag as everything else
        // about their work.
        type: 'task',
        title: 'New comment on a task',
        body: `${task.title} — from the team`,
        link: `/tasks?taskId=${args.taskId}`,
        entityType: 'task',
        entityId: args.taskId,
      })
    }

    if (recipients.length === 0) return

    await notify({
      db: args.serviceDb,
      recipientIds: recipients,
      workspaceId: task.workspace_id,
      actorId: args.actorId,
      type: 'task_comment',
      title: args.actorName ? `${args.actorName} commented` : 'New comment',
      body: 'A new comment was added to a task you’re on.',
      link,
      entityType: 'task',
      entityId: args.taskId,
    })
  } catch (err) {
    console.warn('[notifyCommentParticipants] failed:', err)
  }
}
