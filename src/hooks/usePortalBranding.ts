'use client'

import { useState, useEffect } from 'react'
import { usePortalBrandingContext } from '@/contexts/PortalSessionContext'

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
 * The portal's accent colour.
 *
 * Reads the branding the layout already resolved rather than fetching again.
 * An earlier version always fetched, which meant every page navigation fired a
 * redundant `/branding` request and painted the default pink before repainting
 * in the workspace's real colour.
 *
 * The fetch only happens outside the provider — login, signup and join, which
 * render before there's a session to carry branding.
 */
export function usePortalAccent(subdomain: string): string {
  const fromContext = usePortalBrandingContext()
  // Hooks can't be called conditionally, so the fetching hook still runs; it
  // no-ops on an empty subdomain, which is what it gets once context is present.
  const fetched = usePortalBranding(fromContext ? '' : subdomain)
  return fromContext?.accent_color || fetched?.accent_color || DEFAULT_PORTAL_ACCENT
}
