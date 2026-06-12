'use client'

import { useState, useEffect } from 'react'
import { env } from '@/config/env'

/**
 * Base path for portal links.
 *
 * On a workspace subdomain (<slug>.theruff.agency) the proxy serves the portal
 * under /client/*, so we use the clean "/client" base. Everywhere else
 * (dashboard path-based access, localhost) we use "/portal/<slug>". Both forms
 * resolve, so this is purely about clean URLs.
 *
 * Plain function — for imperative use (router.push) inside callbacks/effects
 * where `window` is always defined.
 */
export function portalBasePath(subdomain: string): string {
  if (typeof window === 'undefined') return `/portal/${subdomain}`
  const root = env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency'
  return window.location.hostname === `${subdomain}.${root}` ? '/client' : `/portal/${subdomain}`
}

/**
 * Hook version for render-time hrefs. Starts at the path-based form (SSR-safe,
 * so there's no hydration mismatch) and upgrades to "/client" after mount when
 * on the workspace subdomain.
 */
export function usePortalBase(subdomain: string): string {
  const [base, setBase] = useState(`/portal/${subdomain}`)
  useEffect(() => {
    setBase(portalBasePath(subdomain))
  }, [subdomain])
  return base
}
