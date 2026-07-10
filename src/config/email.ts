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

/**
 * Builds a link to a client-portal page on the owner's workspace subdomain —
 * https://<slug>.theruff.agency/client/<path>. The subdomain proxy
 * (src/proxy.ts) rewrites /client/* → /portal/<slug>/*, so this is the only
 * URL shape that actually reaches a client's portal from an email. Never link
 * to `${appUrl()}/portal/...` — the root host isn't a workspace subdomain, so
 * the proxy doesn't rewrite it and the [subdomain] segment captures the wrong
 * value. Falls back to the bare app host when the owner has no slug yet (their
 * portal isn't reachable until workspace setup is complete anyway).
 */
export function portalUrl(slug: string | null | undefined, path: string): string {
  const clean = path.replace(/^\/+/, '')
  if (slug) {
    const root = (env.NEXT_PUBLIC_ROOT_DOMAIN ?? DOMAIN)
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
    return `https://${slug}.${root}/client/${clean}`
  }
  return `${appUrl()}/client/${clean}`
}
