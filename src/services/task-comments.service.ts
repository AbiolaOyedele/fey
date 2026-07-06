import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import type { TaskComment } from '@/types/work-tasks'
import * as taskRepo from '@/repositories/work-tasks.repository'
import * as repo from '@/repositories/task-comments.repository'

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
