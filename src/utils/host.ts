import { RESERVED_SLUGS } from '@/lib/workspace-slug'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency'

/**
 * The workspace slug implied by the current hostname, or null when we're not on
 * a workspace subdomain (localhost, *.vercel.app, the apex, or a reserved
 * subdomain like dashboard.*). Used to resolve the "active" workspace — each
 * workspace lives on its own <slug>.theruff.agency.
 */
export function activeWorkspaceSlug(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (!host.endsWith(ROOT_DOMAIN)) return null
  const label = host.slice(0, -(ROOT_DOMAIN.length + 1)) // strip ".theruff.agency"
  if (!label || label.includes('.')) return null          // apex or deeper
  if (RESERVED_SLUGS.has(label)) return null
  return label
}

/** Absolute URL for a workspace's subdomain, preserving an optional path. */
export function workspaceUrl(slug: string, path = '/'): string {
  return `https://${slug}.${ROOT_DOMAIN}${path}`
}
