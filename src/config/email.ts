import { env } from '@/config/env'

/**
 * Centralized email configuration — sender identities and link building.
 *
 * Every FROM address lives here rather than being hardcoded at call sites, so
 * the sending domain and display names are changed in exactly one place. All
 * addresses use the verified `theruff.agency` transactional domain (see
 * EMAIL.md: never send from a generic provider address).
 */

const DOMAIN = 'theruff.agency'

/** Branded sender identities, keyed by purpose. */
export const EMAIL_FROM = {
  /** Team/workspace lifecycle: invites, acceptances, role changes. */
  team: `Fey <team@${DOMAIN}>`,
  /** Internal-chat (Playground) notification alerts. */
  notifications: `Fey <notifications@${DOMAIN}>`,
  /** Invoice delivery. A sender name can be prefixed at the call site. */
  invoices: `invoices@${DOMAIN}`,
  /** CRM document delivery: contracts, forms. */
  documents: `Fey <documents@${DOMAIN}>`,
  /** Portal client onboarding. */
  portal: `Fey <hello@${DOMAIN}>`,
} as const

/**
 * Default Reply-To for alert/notification mail that nobody monitors.
 * Applied automatically in `sendEmail` unless a call site passes its own
 * `replyTo` (e.g. feedback notifications reply to the submitter).
 */
export const NO_REPLY = `no-reply@${DOMAIN}`

/**
 * Returns the public base URL (no trailing slash) used to build links inside
 * emails. Prefers an explicit NEXT_PUBLIC_APP_URL; otherwise derives from the
 * configured root domain; falls back to the production app host.
 */
export function appUrl(): string {
  const explicit = env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const root = env.NEXT_PUBLIC_ROOT_DOMAIN
  if (root) return `https://${root.replace(/^https?:\/\//, '').replace(/\/$/, '')}`

  return `https://app.${DOMAIN}`
}
