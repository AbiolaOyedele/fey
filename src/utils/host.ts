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

/**
 * Where a client signs in for a given workspace.
 *
 * In production each workspace has its own subdomain and the proxy maps
 * /client-login onto that portal's sign-in page. Off the root domain —
 * localhost, preview builds — the subdomain doesn't resolve, so this falls back
 * to the path form the proxy rewrites to, which serves the same page.
 */
export function clientLoginUrl(slug: string): string {
  if (typeof window !== 'undefined' && !window.location.hostname.endsWith(ROOT_DOMAIN)) {
    return `/portal/${slug}/login`
  }
  return workspaceUrl(slug, '/client-login')
}

/**
 * The neutral landing host (dashboard.theruff.agency), used when there's no
 * workspace to land on — e.g. after deleting the last workspace. Going to "/"
 * on a just-deleted subdomain strands the user on a dead workspace URL.
 */
export function neutralUrl(path = '/'): string {
  return `https://dashboard.${ROOT_DOMAIN}${path}`
}
