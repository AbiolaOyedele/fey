import type { SupabaseClient } from '@supabase/supabase-js'
import { destroyCloudinaryAssetById } from '@/lib/cloudinary-server'
import {
  allocationRepository as allocations,
  grantCredits,
} from '@/repositories/image-pipeline/credit.repository'
import {
  generationRepository as generations,
  listExpired,
} from '@/repositories/image-pipeline/generation.repository'
import { flowRepository as flow } from '@/repositories/image-pipeline/settings.repository'

/**
 * Scheduled maintenance for the Image Pipeline. Every function here runs from a
 * cron route with the service-role client — there is no user session to scope
 * by, which is exactly why these routes are gated on CRON_SECRET.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const FLOW_STALE_MS = 10 * 60 * 1000

/**
 * Hourly: grants each due allocation and advances its schedule. Advancing from
 * the *stored* time rather than now keeps the cadence stable even if a run is
 * late, and skipping ahead past missed windows avoids back-granting a pile of
 * credits after downtime.
 */
export async function runCreditGrants(db: SupabaseClient): Promise<{ granted: number }> {
  const now = new Date()
  const due = await allocations.listDue(db, now.toISOString())
  let granted = 0

  for (const allocation of due) {
    try {
      await grantCredits(db, {
        user_id: allocation.user_id,
        delta: allocation.amount,
        reason: 'allocation',
        created_by: allocation.owner_id,
      })

      const step = (allocation.cadence === 'weekly' ? 7 : 30) * DAY_MS
      let next = new Date(allocation.next_grant_at).getTime() + step
      while (next <= now.getTime()) next += step
      await allocations.advanceNextGrant(db, allocation.id, new Date(next).toISOString())
      granted += 1
    } catch (err) {
      console.error('[runCreditGrants] allocation failed', {
        allocationId: allocation.id,
        name: (err as Error)?.name,
      })
    }
  }
  return { granted }
}

/**
 * Daily: deletes the Cloudinary assets for runs past their retention deadline
 * and marks the rows expired. The metadata row is kept (so the gallery can say
 * what expired); only the images go.
 */
export async function runRetentionSweep(db: SupabaseClient): Promise<{ expired: number; assetsDeleted: number }> {
  const expiredRuns = await listExpired(db, new Date().toISOString())
  let assetsDeleted = 0

  for (const run of expiredRuns) {
    for (const publicId of [run.preview_public_id, run.final_public_id]) {
      if (!publicId) continue
      if (await destroyCloudinaryAssetById(publicId, 'image')) assetsDeleted += 1
    }
    try {
      await generations.update(db, run.id, {
        status: 'expired',
        preview_url: null,
        preview_public_id: null,
        final_url: null,
        final_public_id: null,
      })
    } catch (err) {
      console.error('[runRetentionSweep] could not expire run', { generationId: run.id, name: (err as Error)?.name })
    }
  }
  return { expired: expiredRuns.length, assetsDeleted }
}

/** Re-queues Flow jobs a worker claimed but never finished (max 2 attempts). */
export async function runFlowJanitor(db: SupabaseClient): Promise<{ requeued: number }> {
  const cutoff = new Date(Date.now() - FLOW_STALE_MS).toISOString()
  return { requeued: await flow.requeueStale(db, cutoff) }
}
