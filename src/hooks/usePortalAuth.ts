'use client'

import { useMemo } from 'react'

/** localStorage key for a portal client's JWT, scoped by workspace slug. */
export function portalTokenKey(workspaceSlug: string): string {
  return `portal_token_${workspaceSlug}`
}

/**
 * Returns the portal JWT for the given workspace slug, reading it from
 * localStorage.  Returns `null` when no token is stored (i.e. the client
 * is not logged in).
 *
 * This hook centralises all portal-client auth reads so the key format is
 * defined in exactly one place.
 */
export function usePortalToken(subdomain: string): string | null {
  return useMemo(
    () => (typeof window !== 'undefined' ? localStorage.getItem(portalTokenKey(subdomain)) : null),
    [subdomain],
  )
}
