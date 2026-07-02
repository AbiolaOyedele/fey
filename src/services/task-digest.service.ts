import type { SupabaseClient } from '@supabase/supabase-js'
import * as repo from '@/repositories/task-digest.repository'
import { sendTaskDigest } from '@/services/email.service'
import { appUrl } from '@/config/email'

/** Orchestrates the daily task-digest email (called from the cron route). */

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayRangeISO(): { startISO: string; endISO: string } {
  const now = new Date()
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)
  return { startISO: startOfYesterday.toISOString(), endISO: startOfToday.toISOString() }
}

export interface DigestRunResult {
  sent: number
  skipped: number
  failed: number
}

/**
 * A user's digest can span every workspace they belong to (assignee/creator
 * across memberships) — each task needs to say which workspace it's from so
 * it isn't ambiguous which of the user's workspaces (subdomains) it refers to.
 */
async function withWorkspaceNames(db: SupabaseClient, rows: repo.DigestTaskRow[]) {
  const names = await repo.getWorkspaceNames(db, rows.map((r) => r.workspace_id).filter((id): id is string => Boolean(id)))
  return rows.map((r) => ({ ...r, workspaceName: r.workspace_id ? (names.get(r.workspace_id) ?? null) : null }))
}

export async function runDailyDigest(db: SupabaseClient): Promise<DigestRunResult> {
  const digestDate = todayISODate()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { startISO, endISO } = yesterdayRangeISO()
  const tasksUrl = `${appUrl()}/tasks`

  const recipients = await repo.getDigestRecipients(db)
  const result: DigestRunResult = { sent: 0, skipped: 0, failed: 0 }

  for (const { userId, email } of recipients) {
    try {
      if (await repo.hasAlreadySentDigest(db, userId, digestDate)) {
        result.skipped++
        continue
      }

      const [dueOrOverdue, recentlyAssignedRaw, completedYesterday] = await Promise.all([
        repo.getDueOrOverdueTasksForUser(db, userId, digestDate),
        repo.getRecentlyAssignedTasksForUser(db, userId, since24h),
        repo.getCompletedInRangeForUser(db, userId, startISO, endISO),
      ])
      // A just-assigned task that's already due belongs in "due today" only.
      const dueIds = new Set(dueOrOverdue.map((t) => t.id))
      const recentlyAssigned = recentlyAssignedRaw.filter((t) => !dueIds.has(t.id))

      if (dueOrOverdue.length === 0 && recentlyAssigned.length === 0 && completedYesterday.length === 0) {
        result.skipped++
        continue
      }

      const allRows = [...dueOrOverdue, ...recentlyAssigned, ...completedYesterday]
      const withNames = await withWorkspaceNames(db, allRows)
      const byId = new Map(withNames.map((r) => [r.id, r]))
      const withName = (rows: repo.DigestTaskRow[]) => rows.map((r) => byId.get(r.id)!)

      const sendResult = await sendTaskDigest(email, {
        dueOrOverdue: withName(dueOrOverdue),
        recentlyAssigned: withName(recentlyAssigned),
        completedYesterday: withName(completedYesterday),
        tasksUrl,
      })
      if (!sendResult.ok) {
        console.warn('[task-digest] send failed', { userId, error: sendResult.error })
        result.failed++
        continue
      }

      await repo.logDigestSent(db, userId, digestDate)
      result.sent++
    } catch (err) {
      console.warn('[task-digest] failed for user', userId, err)
      result.failed++
    }
  }

  return result
}
