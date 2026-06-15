import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { ADMIN_EMAIL_LIST } from '@/config/env'
import { insertFeedback } from '@/repositories/feedback.repository'
import { sendFeedbackNotification } from '@/services/email.service'
import type { Feedback } from '@/types/feedback'

const submitSchema = z.object({
  type: z.enum(['bug', 'feature', 'other']),
  message: z.string().trim().min(3, 'Please add a little more detail.').max(5000),
  page_url: z.string().max(2000).optional().nullable(),
  workspace_id: z.string().uuid().optional().nullable(),
  source: z.enum(['owner', 'portal']).optional(),
})

interface SubmitContext {
  userId: string
  userEmail: string | null
  userAgent: string | null
}

/**
 * Validates and stores a feedback submission, then best-effort emails the admin
 * allowlist. Email failure never fails the request — the row is the record.
 */
export async function submitFeedback(
  db: SupabaseClient,
  ctx: SubmitContext,
  input: unknown,
): Promise<Feedback> {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid feedback.', 'FEEDBACK_INVALID_INPUT')
  }
  const { type, message, page_url, workspace_id, source } = parsed.data

  const feedback = await insertFeedback(db, {
    user_id: ctx.userId,
    workspace_id: workspace_id ?? null,
    source: source ?? 'owner',
    type,
    message,
    page_url: page_url ?? null,
    user_agent: ctx.userAgent,
  })

  if (ADMIN_EMAIL_LIST.length > 0) {
    void sendFeedbackNotification(ADMIN_EMAIL_LIST, {
      type,
      message,
      fromEmail: ctx.userEmail ?? 'unknown',
      source: source ?? 'owner',
      pageUrl: page_url ?? null,
    })
  }

  return feedback
}
