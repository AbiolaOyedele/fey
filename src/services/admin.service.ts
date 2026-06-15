import type { SupabaseClient } from '@supabase/supabase-js'
import { countRows, sumColumn, fetchCreatedAt } from '@/repositories/admin.repository'
import { listAllFeedback } from '@/repositories/feedback.repository'
import type { Feedback } from '@/types/feedback'

export interface AdminMetrics {
  workspaces: number
  members: number
  clients: { total: number; archived: number }
  portalUsers: { total: number; active7d: number; active30d: number }
  messages: { total: number; fromClients: number }
  files: { total: number; totalBytes: number }
  invoices: { total: number; paid: number }
  contracts: { total: number; signed: number }
  forms: { total: number; submitted: number }
  feedback: { new: number; total: number }
  signupsByWeek: Array<{ week: string; count: number }>
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/** Buckets ISO timestamps into the last 12 weeks (oldest → newest). */
function bucketByWeek(timestamps: string[]): Array<{ week: string; count: number }> {
  const weeks = 12
  const now = Date.now()
  const msWeek = 7 * 24 * 60 * 60 * 1000
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = now - (weeks - 1 - i) * msWeek
    return { week: new Date(start).toISOString().slice(0, 10), count: 0 }
  })
  for (const ts of timestamps) {
    const t = new Date(ts).getTime()
    if (Number.isNaN(t)) continue
    const idx = weeks - 1 - Math.floor((now - t) / msWeek)
    if (idx >= 0 && idx < weeks) buckets[idx]!.count++
  }
  return buckets
}

/**
 * Assembles the full admin metrics snapshot. All reads go through the
 * defensive repository helpers, so partial data never throws.
 *
 * TODO(posthog): when PostHog lands, event-based metrics (funnels, retention,
 * active users) can be merged into this object behind the same return shape.
 */
export async function getMetrics(db: SupabaseClient): Promise<AdminMetrics> {
  const seven = daysAgoIso(7)
  const thirty = daysAgoIso(30)

  const [
    workspaces, members,
    clientsTotal, clientsArchived,
    portalTotal, portalActive7d, portalActive30d,
    messagesTotal, messagesFromClients,
    filesTotal, filesBytes,
    invoicesTotal, invoicesPaid,
    contractsTotal, contractsSigned,
    formsTotal, formsSubmitted,
    feedbackNew, feedbackTotal,
    workspaceTimes,
  ] = await Promise.all([
    countRows(db, 'workspaces'),
    countRows(db, 'workspace_members'),
    countRows(db, 'crm_contacts'),
    countRows(db, 'crm_contacts', { notNull: 'archived_at' }),
    countRows(db, 'portal_users'),
    countRows(db, 'portal_users', { gte: { column: 'last_seen_at', value: seven } }),
    countRows(db, 'portal_users', { gte: { column: 'last_seen_at', value: thirty } }),
    countRows(db, 'crm_messages'),
    countRows(db, 'crm_messages', { eq: { sender_type: 'client' } }),
    countRows(db, 'crm_files'),
    sumColumn(db, 'crm_files', 'file_size'),
    countRows(db, 'invoices', { eq: { app: 'fey' } }),
    countRows(db, 'invoices', { eq: { app: 'fey', status: 'paid' } }),
    countRows(db, 'crm_contracts'),
    countRows(db, 'crm_contracts', { eq: { status: 'signed' } }),
    countRows(db, 'crm_forms'),
    countRows(db, 'crm_forms', { eq: { status: 'submitted' } }),
    countRows(db, 'feedback', { eq: { status: 'new' } }),
    countRows(db, 'feedback'),
    fetchCreatedAt(db, 'workspaces'),
  ])

  return {
    workspaces,
    members,
    clients: { total: clientsTotal, archived: clientsArchived },
    portalUsers: { total: portalTotal, active7d: portalActive7d, active30d: portalActive30d },
    messages: { total: messagesTotal, fromClients: messagesFromClients },
    files: { total: filesTotal, totalBytes: filesBytes },
    invoices: { total: invoicesTotal, paid: invoicesPaid },
    contracts: { total: contractsTotal, signed: contractsSigned },
    forms: { total: formsTotal, submitted: formsSubmitted },
    feedback: { new: feedbackNew, total: feedbackTotal },
    signupsByWeek: bucketByWeek(workspaceTimes),
  }
}

/** Lists all feedback for the admin inbox (service-role; newest first). */
export function getFeedbackInbox(db: SupabaseClient): Promise<Feedback[]> {
  return listAllFeedback(db)
}
