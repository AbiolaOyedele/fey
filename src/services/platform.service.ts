import type { SupabaseClient } from '@supabase/supabase-js'
import { countRows } from '@/repositories/admin.repository'
import { env } from '@/config/env'

/**
 * Read-only snapshots for the PlayGround control plane.
 *
 * PlayGround observes this app; it never acts on it. Everything here is a read,
 * and no write path should ever be added — a control plane that can mutate five
 * products from one compromised key is a far larger blast radius than one that
 * can only look.
 *
 * Kept deliberately separate from `admin.service.ts`. That module's `getMetrics()`
 * runs roughly twenty count queries to build the interactive dashboard, which is
 * fine for a human clicking once but far too heavy for an endpoint polled on a
 * schedule. Nothing here reuses it.
 */

export type HealthStatus = 'ok' | 'degraded' | 'down'

export interface PlatformHealth {
  status: HealthStatus
  checkedAt: string
}

export interface PlatformStats {
  workspaces: number
  members: number
  clients: number
  portalUsers: number
  portalActive7d: number
  invoices: number
  invoicesPaid: number
  checkedAt: string
}

export interface PlatformBilling {
  applicable: true
  provider: 'paystack'
  currency: string | null
  invoicesTotal: number
  invoicesPaid: number
  invoicesOverdue: number
  grossPaid: number
  checkedAt: string
}

/**
 * Real health, not just route responsiveness.
 *
 * `down` means the database did not answer — nothing in this app works in that
 * state. `degraded` means it is serving but a dependency the product depends on
 * (transactional email, or the portal's JWT signing secret) is unconfigured, so
 * some journeys will fail even though pages render.
 */
export async function getHealth(db: SupabaseClient): Promise<PlatformHealth> {
  const checkedAt = new Date().toISOString()

  // `countRows` swallows its own errors and returns 0, which cannot distinguish
  // "empty table" from "database down". The probe is therefore done directly.
  let databaseUp = false
  try {
    const { error } = await db.from('workspaces').select('id', { count: 'exact', head: true })
    databaseUp = !error
  } catch {
    databaseUp = false
  }

  if (!databaseUp) return { status: 'down', checkedAt }

  const coreConfigured = Boolean(env.RESEND_API_KEY) && Boolean(env.PORTAL_JWT_SECRET)
  return { status: coreConfigured ? 'ok' : 'degraded', checkedAt }
}

/**
 * Small metrics snapshot — seven indexed `count(*)` queries run concurrently.
 *
 * Chosen because each is a head-only count on an indexed column, which Postgres
 * answers without reading rows. The heavier parts of the admin dashboard
 * (12-week signup buckets, file-size sums, per-workspace timings) are excluded
 * on purpose.
 */
export async function getStats(db: SupabaseClient): Promise<PlatformStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [workspaces, members, clients, portalUsers, portalActive7d, invoices, invoicesPaid] =
    await Promise.all([
      countRows(db, 'workspaces'),
      countRows(db, 'workspace_members'),
      countRows(db, 'crm_contacts'),
      countRows(db, 'portal_users'),
      countRows(db, 'portal_users', { gte: { column: 'last_seen_at', value: sevenDaysAgo } }),
      countRows(db, 'invoices', { eq: { app: 'fey' } }),
      countRows(db, 'invoices', { eq: { app: 'fey', status: 'paid' } }),
    ])

  return {
    workspaces,
    members,
    clients,
    portalUsers,
    portalActive7d,
    invoices,
    invoicesPaid,
    checkedAt: new Date().toISOString(),
  }
}

interface InvoiceRollupRow {
  status: string | null
  currency: string | null
  totals: { total?: number } | null
}

/**
 * Read-only invoice rollup. Totals only — nothing identifying a client or a
 * payer ever leaves this endpoint.
 *
 * Invoice amounts live inside a `totals` JSONB column rather than a scalar, so
 * the sum is done in application code; there is no column for Postgres to
 * aggregate directly.
 */
export async function getBilling(db: SupabaseClient): Promise<PlatformBilling> {
  const { data, error } = await db
    .from('invoices')
    .select('status, currency, totals')
    .eq('app', 'fey')
    .limit(50_000)

  if (error) {
    // Billing being unavailable must not read as "zero revenue" — the caller is
    // told the truth by way of a thrown error, which the route maps to a 502.
    throw new Error(`invoice rollup failed: ${error.message}`)
  }

  const rows = (data ?? []) as InvoiceRollupRow[]
  let invoicesPaid = 0
  let invoicesOverdue = 0
  let grossPaid = 0
  let currency: string | null = null

  for (const row of rows) {
    if (row.status === 'paid') {
      invoicesPaid += 1
      grossPaid += row.totals?.total ?? 0
      currency ??= row.currency
    } else if (row.status === 'overdue') {
      invoicesOverdue += 1
    }
  }

  return {
    applicable: true,
    provider: 'paystack',
    currency,
    invoicesTotal: rows.length,
    invoicesPaid,
    invoicesOverdue,
    grossPaid,
    checkedAt: new Date().toISOString(),
  }
}
