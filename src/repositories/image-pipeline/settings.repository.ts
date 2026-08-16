import type { SupabaseClient } from '@supabase/supabase-js'
import {
  RATE_KEYS,
  type FlowRepository,
  type IpFlowJob,
  type IpRateConfig,
  type IpUserSettings,
  type IpWorkerHeartbeat,
  type RateKey,
  type RatesMap,
  type RetentionWeeks,
  type UserSettingsRepository,
} from '@/types/image-pipeline'

/**
 * Queries for ip_user_settings, ip_rates_config, and the Flow-channel tables.
 * Queries only — who may set a tier override, and who may edit rates, is
 * decided in the service layer.
 */

const SETTINGS_SELECT =
  'user_id, owner_id, image_tier_override, skip_prompt_review, retention_weeks, default_image_model, updated_at'
const RATE_SELECT = 'key, value, note, updated_at'
const FLOW_JOB_SELECT = 'id, generation_id, status, attempts, claimed_at, error_message, created_at, updated_at'

/** Upsert helper — every setter writes the same row, changing one field. */
async function upsertSettings(
  db: SupabaseClient,
  scope: { user_id: string; owner_id: string },
  patch: Record<string, unknown>,
): Promise<IpUserSettings> {
  const { data, error } = await db
    .from('ip_user_settings')
    .upsert(
      { user_id: scope.user_id, owner_id: scope.owner_id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select(SETTINGS_SELECT)
    .single()
  if (error) throw error
  return toSettings(data)
}

export const userSettingsRepository: UserSettingsRepository = {
  async getForUser(db, userId) {
    const { data, error } = await db
      .from('ip_user_settings')
      .select(SETTINGS_SELECT)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? toSettings(data) : null
  },

  setTierOverride: (db, scope, override) => upsertSettings(db, scope, { image_tier_override: override }),
  setSkipPromptReview: (db, scope, skip) => upsertSettings(db, scope, { skip_prompt_review: skip }),
  setRetentionWeeks: (db, scope, weeks) => upsertSettings(db, scope, { retention_weeks: weeks }),
  setDefaultImageModel: (db, scope, model) => upsertSettings(db, scope, { default_image_model: model }),
}

/** Settings rows for a set of users in one round trip (admin user list). */
export async function settingsFor(db: SupabaseClient, userIds: string[]): Promise<Record<string, IpUserSettings>> {
  if (userIds.length === 0) return {}
  const { data, error } = await db.from('ip_user_settings').select(SETTINGS_SELECT).in('user_id', userIds)
  if (error) throw error
  const byUser: Record<string, IpUserSettings> = {}
  for (const row of data ?? []) {
    const settings = toSettings(row)
    byUser[settings.user_id] = settings
  }
  return byUser
}

function toSettings(row: unknown): IpUserSettings {
  const r = row as IpUserSettings & { retention_weeks: number }
  return {
    ...r,
    retention_weeks: (r.retention_weeks === 1 ? 1 : 2) as RetentionWeeks,
    default_image_model: r.default_image_model ?? null,
  }
}

export const ratesRepository = {
  async getAll(db: SupabaseClient): Promise<IpRateConfig[]> {
    const { data, error } = await db.from('ip_rates_config').select(RATE_SELECT).order('key')
    if (error) throw error
    return (data ?? []).map(toRate)
  },

  async getMap(db: SupabaseClient): Promise<RatesMap> {
    const rows = await ratesRepository.getAll(db)
    const map = Object.fromEntries(RATE_KEYS.map((key) => [key, 0])) as RatesMap
    for (const row of rows) map[row.key] = row.value
    return map
  },

  async update(db: SupabaseClient, key: RateKey, value: number): Promise<IpRateConfig> {
    const { data, error } = await db
      .from('ip_rates_config')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select(RATE_SELECT)
      .single()
    if (error) throw error
    return toRate(data)
  },
}

function toRate(row: unknown): IpRateConfig {
  const r = row as IpRateConfig
  return { ...r, value: Number(r.value) }
}

export const flowRepository: FlowRepository = {
  async enqueue(db, generationId) {
    const { data, error } = await db
      .from('ip_flow_jobs')
      .insert({ generation_id: generationId })
      .select(FLOW_JOB_SELECT)
      .single()
    if (error) throw error
    return data as IpFlowJob
  },

  /**
   * Atomic claim: the UPDATE ... WHERE status='queued' only matches a job no
   * other worker has taken, so two workers can never claim the same job.
   */
  async claimNext(db, workerId) {
    const { data: candidate, error: pickError } = await db
      .from('ip_flow_jobs')
      .select('id, attempts')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (pickError) throw pickError
    if (!candidate) return null

    const row = candidate as { id: string; attempts: number }
    const { data, error } = await db
      .from('ip_flow_jobs')
      .update({
        status: 'claimed',
        worker_id: workerId,
        attempts: row.attempts + 1,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'queued')
      .select(FLOW_JOB_SELECT)
      .maybeSingle()
    if (error) throw error
    return (data as IpFlowJob | null) ?? null
  },

  async markStatus(db, id, input) {
    const { data, error } = await db
      .from('ip_flow_jobs')
      .update({
        status: input.status,
        error_message: input.error_message ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(FLOW_JOB_SELECT)
      .single()
    if (error) throw error
    return data as IpFlowJob
  },

  async requeueStale(db, olderThan) {
    const { data, error } = await db
      .from('ip_flow_jobs')
      .update({ status: 'queued', claimed_at: null, updated_at: new Date().toISOString() })
      .eq('status', 'claimed')
      .lt('claimed_at', olderThan)
      .lt('attempts', 2)
      .select('id')
    if (error) throw error
    return (data ?? []).length
  },

  async upsertHeartbeat(db, workerId) {
    const { error } = await db
      .from('ip_worker_heartbeat')
      .upsert({ worker_id: workerId, last_seen: new Date().toISOString() }, { onConflict: 'worker_id' })
    if (error) throw error
  },

  async getHeartbeats(db) {
    const { data, error } = await db.from('ip_worker_heartbeat').select('worker_id, last_seen')
    if (error) throw error
    return (data ?? []) as IpWorkerHeartbeat[]
  },
}
