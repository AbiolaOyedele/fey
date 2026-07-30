/**
 * Image Pipeline — in-memory mock store (Batch 1).
 *
 * Holds all module state for the mock-data phase: a fake signed-in user plus a
 * couple of teammates (so admin views have rows), seeded generations, a credit
 * ledger, allocations, requests, rates and per-user settings. Everything here is
 * replaced by Supabase in Batch 2 — nothing in this file ships to production.
 *
 * Timestamps are computed once at module load so the UI (expiry countdowns,
 * ledger ordering) looks realistic without persistence.
 */

import {
  DEFAULT_RETENTION_WEEKS,
  RATE_KEYS,
  type ImageTier,
  type IpGeneration,
  type IpCreditLedgerEntry,
  type IpCreditAllocation,
  type IpCreditRequest,
  type IpRateConfig,
  type IpUserSettings,
  type IpFlowJob,
  type IpWorkerHeartbeat,
} from '@/types/image-pipeline'

/** A mock team member. In Batch 2 this maps onto auth.users + workspace_members. */
export interface MockUser {
  id: string
  email: string
  display_name: string
  /** Workspace role — drives the workspace-admin capability. */
  role: 'owner' | 'admin' | 'member'
  /** In the ADMIN_EMAILS allowlist (app-wide super admin). */
  is_super_admin: boolean
}

const now = Date.now()
const iso = (msFromNow: number): string => new Date(now + msFromNow).toISOString()
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** The signed-in mock user. Owner + platform admin so every view is reachable. */
export const MOCK_OWNER_ID = 'usr_owner'

export const mockUsers: MockUser[] = [
  { id: MOCK_OWNER_ID, email: 'you@ruff.agency', display_name: 'You', role: 'owner', is_super_admin: true },
  { id: 'usr_amara', email: 'amara@ruff.agency', display_name: 'Amara Okoye', role: 'member', is_super_admin: false },
  { id: 'usr_deji', email: 'deji@ruff.agency', display_name: 'Deji Balogun', role: 'member', is_super_admin: false },
]

/**
 * Mutable module state. Repositories read and mutate these arrays directly.
 * A running counter gives stable, collision-free ids without Math.random.
 */
let seq = 100
export const nextId = (prefix: string): string => `${prefix}_${(seq += 1)}`

const pic = (seed: string, size = 800): string => `https://picsum.photos/seed/${seed}/${size}/${size}`

export const state = {
  users: mockUsers,
  currentUserId: MOCK_OWNER_ID,

  generations: [
    {
      id: 'gen_1',
      user_id: MOCK_OWNER_ID,
      owner_id: MOCK_OWNER_ID,
      channel: 'api',
      tier: 'pro',
      status: 'complete',
      source_image_public_id: 'image-pipeline/usr_owner/gen_1/source',
      source_image_url: pic('ref-1', 400),
      user_prompt: null,
      user_notes: 'Make it feel like a sunlit editorial cover.',
      generated_prompt: 'A sunlit editorial portrait, warm golden-hour light, shallow depth of field, magazine cover framing.',
      final_prompt: 'A sunlit editorial portrait, warm golden-hour light, shallow depth of field, magazine cover framing.',
      preview_public_id: 'image-pipeline/usr_owner/gen_1/preview',
      preview_url: pic('prev-1'),
      final_public_id: 'image-pipeline/usr_owner/gen_1/final',
      final_url: pic('final-1', 1600),
      error_message: null,
      created_at: iso(-6 * HOUR),
      updated_at: iso(-6 * HOUR + 90_000),
      expires_at: iso(7 * DAY - 6 * HOUR),
    },
    {
      id: 'gen_2',
      user_id: MOCK_OWNER_ID,
      owner_id: MOCK_OWNER_ID,
      channel: 'api',
      tier: 'pro',
      status: 'complete',
      source_image_public_id: null,
      source_image_url: null,
      user_prompt: 'moody product shot on dark stone',
      user_notes: null,
      generated_prompt: 'A moody product still life on dark stone, dramatic side lighting, high detail.',
      final_prompt: 'A moody product still life on dark slate, dramatic side lighting, crisp reflections, high detail.',
      preview_public_id: 'image-pipeline/usr_owner/gen_2/preview',
      preview_url: pic('prev-2'),
      final_public_id: 'image-pipeline/usr_owner/gen_2/final',
      final_url: pic('final-2', 1600),
      error_message: null,
      created_at: iso(-2 * DAY),
      updated_at: iso(-2 * DAY + 120_000),
      expires_at: iso(5 * DAY),
    },
    {
      id: 'gen_3',
      user_id: MOCK_OWNER_ID,
      owner_id: MOCK_OWNER_ID,
      channel: 'api',
      tier: 'standard',
      status: 'rejected',
      source_image_public_id: 'image-pipeline/usr_owner/gen_3/source',
      source_image_url: pic('ref-3', 400),
      user_prompt: null,
      user_notes: 'Try a neon cyberpunk alley.',
      generated_prompt: 'A neon cyberpunk alley at night, rain-slick ground, glowing signage, cinematic haze.',
      final_prompt: 'A neon cyberpunk alley at night, rain-slick ground, glowing signage, cinematic haze.',
      // Rejected previews are RETAINED now — they auto-delete on expiry like any image.
      preview_public_id: 'image-pipeline/usr_owner/gen_3/preview',
      preview_url: pic('prev-3'),
      final_public_id: null,
      final_url: null,
      error_message: null,
      created_at: iso(-30 * HOUR),
      updated_at: iso(-30 * HOUR + 60_000),
      expires_at: iso(5 * DAY + 18 * HOUR),
    },
  ] as IpGeneration[],

  ledger: [
    { id: 'led_1', user_id: MOCK_OWNER_ID, owner_id: MOCK_OWNER_ID, delta: 10, reason: 'allocation', generation_id: null, created_by: null, created_at: iso(-7 * DAY) },
    { id: 'led_2', user_id: MOCK_OWNER_ID, owner_id: MOCK_OWNER_ID, delta: -0.25, reason: 'preview_charge', generation_id: 'gen_1', created_by: null, created_at: iso(-6 * HOUR) },
    { id: 'led_3', user_id: MOCK_OWNER_ID, owner_id: MOCK_OWNER_ID, delta: -0.75, reason: 'final_charge', generation_id: 'gen_1', created_by: null, created_at: iso(-6 * HOUR + 90_000) },
    { id: 'led_4', user_id: MOCK_OWNER_ID, owner_id: MOCK_OWNER_ID, delta: -0.25, reason: 'preview_charge', generation_id: 'gen_2', created_by: null, created_at: iso(-2 * DAY) },
    { id: 'led_5', user_id: MOCK_OWNER_ID, owner_id: MOCK_OWNER_ID, delta: -0.75, reason: 'final_charge', generation_id: 'gen_2', created_by: null, created_at: iso(-2 * DAY + 120_000) },
    { id: 'led_6', user_id: MOCK_OWNER_ID, owner_id: MOCK_OWNER_ID, delta: -0.25, reason: 'preview_charge', generation_id: 'gen_3', created_by: null, created_at: iso(-30 * HOUR) },
    // Teammate ledger — for the admin cost dashboard.
    { id: 'led_7', user_id: 'usr_amara', owner_id: MOCK_OWNER_ID, delta: 20, reason: 'allocation', generation_id: null, created_by: null, created_at: iso(-7 * DAY) },
    { id: 'led_8', user_id: 'usr_amara', owner_id: MOCK_OWNER_ID, delta: -3, reason: 'preview_charge', generation_id: null, created_by: null, created_at: iso(-3 * DAY) },
    { id: 'led_9', user_id: 'usr_deji', owner_id: MOCK_OWNER_ID, delta: 20, reason: 'allocation', generation_id: null, created_by: null, created_at: iso(-7 * DAY) },
    { id: 'led_10', user_id: 'usr_deji', owner_id: MOCK_OWNER_ID, delta: -1, reason: 'final_charge', generation_id: null, created_by: null, created_at: iso(-1 * DAY) },
  ] as IpCreditLedgerEntry[],

  allocations: [
    { id: 'alloc_1', user_id: MOCK_OWNER_ID, owner_id: MOCK_OWNER_ID, amount: 10, cadence: 'weekly', next_grant_at: iso(0 * DAY), created_at: iso(-7 * DAY), updated_at: iso(-7 * DAY) },
    { id: 'alloc_2', user_id: 'usr_amara', owner_id: MOCK_OWNER_ID, amount: 20, cadence: 'monthly', next_grant_at: iso(23 * DAY), created_at: iso(-7 * DAY), updated_at: iso(-7 * DAY) },
    { id: 'alloc_3', user_id: 'usr_deji', owner_id: MOCK_OWNER_ID, amount: 20, cadence: 'monthly', next_grant_at: iso(23 * DAY), created_at: iso(-7 * DAY), updated_at: iso(-7 * DAY) },
  ] as IpCreditAllocation[],

  requests: [
    { id: 'req_1', user_id: 'usr_amara', owner_id: MOCK_OWNER_ID, amount: 15, note: 'Client campaign push this week — running low.', status: 'pending', resolved_by: null, created_at: iso(-4 * HOUR), updated_at: iso(-4 * HOUR) },
  ] as IpCreditRequest[],

  rates: RATE_KEYS.map<IpRateConfig>((key) => ({
    key,
    value: {
      anchor_cost_per_credit_usd: 0.6,
      std_preview_usd: 0.039,
      pro_preview_usd: 0.134,
      pro_final_2k_usd: 0.134,
      std_final_2k_usd: 0.039,
      prompt_haiku_est_usd: 0.005,
      prompt_sonnet_est_usd: 0.02,
    }[key],
    note: null,
    updated_at: iso(-7 * DAY),
  })),

  settings: [
    { user_id: MOCK_OWNER_ID, owner_id: MOCK_OWNER_ID, image_tier_override: null, skip_prompt_review: false, retention_weeks: DEFAULT_RETENTION_WEEKS, updated_at: iso(-7 * DAY) },
    { user_id: 'usr_amara', owner_id: MOCK_OWNER_ID, image_tier_override: null, skip_prompt_review: true, retention_weeks: 1, updated_at: iso(-7 * DAY) },
    { user_id: 'usr_deji', owner_id: MOCK_OWNER_ID, image_tier_override: 'pro', skip_prompt_review: false, retention_weeks: DEFAULT_RETENTION_WEEKS, updated_at: iso(-7 * DAY) },
  ] as IpUserSettings[],

  flowJobs: [] as IpFlowJob[],
  // No worker online in the mock — Flow channel shows as offline everywhere.
  heartbeats: [] as IpWorkerHeartbeat[],
}

/* ── Tiny pub/sub so hooks can react to simulated pipeline transitions,
 *    standing in for Supabase Realtime until Batch 2. ── */

type Listener = (gen: IpGeneration) => void
const listeners = new Map<string, Set<Listener>>()

export function subscribeGeneration(id: string, cb: Listener): () => void {
  const set = listeners.get(id) ?? new Set<Listener>()
  set.add(cb)
  listeners.set(id, set)
  return () => set.delete(cb)
}

export function emitGeneration(gen: IpGeneration): void {
  listeners.get(gen.id)?.forEach((cb) => cb(gen))
}

/** Resolve a mock user record. */
export const findUser = (id: string): MockUser | undefined => state.users.find((u) => u.id === id)

/** Balance = SUM(delta) of the user's ledger. */
export const balanceOf = (userId: string): number =>
  Math.round(state.ledger.filter((l) => l.user_id === userId).reduce((s, l) => s + l.delta, 0) * 100) / 100

/** Server-side tier resolution, mirrored for the mock. */
export function resolveTier(userId: string): ImageTier {
  const settings = state.settings.find((s) => s.user_id === userId)
  if (settings?.image_tier_override) return settings.image_tier_override
  const user = findUser(userId)
  if (user?.is_super_admin || user?.role === 'owner' || user?.role === 'admin') return 'pro'
  return 'standard'
}
