'use client'

import { useState, useEffect } from 'react'

export interface PortalBranding {
  business_name: string
  owner_name:    string
  logo_url:      string | null
  accent_color:  string
}

/**
 * Fetches workspace branding for the given subdomain from the public
 * /api/v1/portal/branding endpoint.  Used on the login and join pages.
 * Returns null while loading or if the workspace is not found.
 */
export function usePortalBranding(subdomain: string): PortalBranding | null {
  const [branding, setBranding] = useState<PortalBranding | null>(null)

  useEffect(() => {
    if (!subdomain) return
    void fetch(`/api/v1/portal/branding?slug=${encodeURIComponent(subdomain)}`)
      .then((res) => (res.ok ? (res.json() as Promise<PortalBranding>) : null))
      .then((data) => { if (data) setBranding(data) })
      .catch(() => { /* branding is cosmetic — non-fatal */ })
  }, [subdomain])

  return branding
}

/** Fey's default accent, used until branding resolves (or if none is set). */
export const DEFAULT_PORTAL_ACCENT = '#ED64A6'

/**
 * Just the accent colour for a portal, with a sensible default while branding
 * loads. Saves every page re-deriving `branding?.accent_color || '#ED64A6'`,
 * and keeps the fallback in one place.
 */
export function usePortalAccent(subdomain: string): string {
  const branding = usePortalBranding(subdomain)
  return branding?.accent_color || DEFAULT_PORTAL_ACCENT
}
