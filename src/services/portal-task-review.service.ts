import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import { isReadOnly } from '@/services/portal-members.service'
import * as reviewService from '@/services/task-review.service'
import type { ReviewComment, ReviewVersion } from '@/types/task-review'
import type { PortalRole } from '@/types/crm'

/**
 * The Review tab, as the client sees it.
 *
 * The rules themselves live in task-review.service — versioning, the three-
 * version cap, Cloudinary cleanup — so the two sides can't drift. What's here
 * is the part that's specific to a portal caller:
 *
 *  1. **The fence.** Portal requests run service-role with no RLS, so every
 *     entry point below re-checks that the task belongs to this client's
 *     contact, using the contact id lifted from the verified token. Note this
 *     is deliberately WIDER than portal-tasks.service's assertOwnTask: a client
 *     reviews work the agency produced, which they did not raise. It is still
 *     fenced to their own contact.
 *
 *  2. **Read-only members.** A viewer may read the history but not upload a
 *     version or rule on one, matching every other portal write path.
 */

export interface PortalReviewScope {
  contactId: string
  ownerId: string
}

export interface PortalReviewActor {
  portalUserId: string
  name: string | null
  role: PortalRole
}

/**
 * The task must belong to this client's contact. Anything else is a 404 rather
 * than a 403 — a client shouldn't be able to probe which task ids exist.
 */
async function assertTaskForContact(
  db: SupabaseClient,
  scope: PortalReviewScope,
  taskId: string,
): Promise<void> {
  const { data } = await db
    .from('work_tasks')
    .select('id')
    .eq('id', taskId)
    .eq('owner_id', scope.ownerId)
    .eq('contact_id', scope.contactId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) {
    throw new AppError(404, 'That task could not be found.', 'PORTAL_REVIEW_TASK_NOT_FOUND')
  }
}

function assertCanWrite(actor: PortalReviewActor): void {
  if (isReadOnly(actor.role)) {
    throw new AppError(403, 'Your access is view-only, so you can’t review this.', 'PORTAL_REVIEW_FORBIDDEN')
  }
}

export async function listReviews(
  db: SupabaseClient,
  scope: PortalReviewScope,
  taskId: string,
): Promise<ReviewVersion[]> {
  await assertTaskForContact(db, scope, taskId)
  return reviewService.listReviews(db, taskId, 'client')
}

/** Sends the client's own draft for review. */
export async function submitVersion(
  db: SupabaseClient,
  scope: PortalReviewScope,
  taskId: string,
  reviewId: string,
  actor: PortalReviewActor,
): Promise<{ version: ReviewVersion; pruned: number[] }> {
  await assertTaskForContact(db, scope, taskId)
  assertCanWrite(actor)
  return reviewService.submitVersion(db, taskId, reviewId, {
    portalUserId: actor.portalUserId,
    name: actor.name,
    type: 'client',
  })
}

export async function deleteVersion(
  db: SupabaseClient,
  scope: PortalReviewScope,
  taskId: string,
  reviewId: string,
  actor: PortalReviewActor,
): Promise<void> {
  await assertTaskForContact(db, scope, taskId)
  assertCanWrite(actor)
  return reviewService.deleteVersion(db, taskId, reviewId)
}

export async function deleteVersionFile(
  db: SupabaseClient,
  scope: PortalReviewScope,
  taskId: string,
  reviewId: string,
  fileId: string,
  actor: PortalReviewActor,
): Promise<void> {
  await assertTaskForContact(db, scope, taskId)
  assertCanWrite(actor)
  return reviewService.deleteVersionFile(db, taskId, reviewId, fileId)
}

/** A client can supply the deliverable too — a signed-off asset, a brief, a revision. */
export async function addVersion(
  db: SupabaseClient,
  scope: PortalReviewScope,
  taskId: string,
  input: unknown,
  actor: PortalReviewActor,
): Promise<{ version: ReviewVersion; pruned: number[] }> {
  await assertTaskForContact(db, scope, taskId)
  assertCanWrite(actor)
  return reviewService.addVersion(db, taskId, input, {
    portalUserId: actor.portalUserId,
    name: actor.name,
    type: 'client',
  })
}

export async function addComment(
  db: SupabaseClient,
  scope: PortalReviewScope,
  taskId: string,
  reviewId: string,
  input: unknown,
  actor: PortalReviewActor,
): Promise<ReviewComment> {
  await assertTaskForContact(db, scope, taskId)
  assertCanWrite(actor)
  return reviewService.addComment(db, taskId, reviewId, input, {
    portalUserId: actor.portalUserId,
    name: actor.name,
    type: 'client',
  })
}
