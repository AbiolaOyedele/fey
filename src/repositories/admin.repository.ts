import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Admin metric queries. These run with a service-role client (RLS bypassed) and
 * are only ever reached after the route verifies an admin caller. Every helper
 * is defensive: a missing table or column resolves to 0 / [] rather than
 * throwing, so one absent migration never blanks the whole board.
 */

/** Exact row count with optional equality + gte filters. Returns 0 on error. */
export async function countRows(
  db: SupabaseClient,
  table: string,
  opts: { eq?: Record<string, string>; gte?: { column: string; value: string }; notNull?: string } = {},
): Promise<number> {
  try {
    let q = db.from(table).select('*', { count: 'exact', head: true })
    for (const [col, val] of Object.entries(opts.eq ?? {})) q = q.eq(col, val)
    if (opts.gte) q = q.gte(opts.gte.column, opts.gte.value)
    if (opts.notNull) q = q.not(opts.notNull, 'is', null)
    const { count, error } = await q
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

/** Sum of a numeric column across a table. Returns 0 on error. MVP-scale only. */
export async function sumColumn(db: SupabaseClient, table: string, column: string): Promise<number> {
  try {
    const { data, error } = await db.from(table).select(column)
    if (error || !data) return 0
    return (data as unknown as Array<Record<string, number | null>>)
      .reduce((acc, row) => acc + (row[column] ?? 0), 0)
  } catch {
    return 0
  }
}

/** Fetches created_at timestamps for a table (for time-series bucketing). */
export async function fetchCreatedAt(db: SupabaseClient, table: string): Promise<string[]> {
  try {
    const { data, error } = await db.from(table).select('created_at')
    if (error || !data) return []
    return (data as Array<{ created_at: string | null }>)
      .map((r) => r.created_at)
      .filter((v): v is string => Boolean(v))
  } catch {
    return []
  }
}
