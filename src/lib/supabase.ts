'use client'

import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/config/env'

/**
 * Owner-side Supabase browser client.
 *
 * Uses cookie storage (via @supabase/ssr) scoped to the ROOT domain, so a
 * single login is shared across dashboard.theruff.agency AND every
 * <slug>.theruff.agency — true cross-subdomain SSO. On localhost and preview
 * (*.vercel.app) we fall back to a host-scoped cookie (no domain attribute).
 *
 * NB: this is a one-time switch from localStorage — existing owner sessions
 * won't carry over, so owners log in once after deploy. Portal clients use a
 * separate JWT (portal_token_<slug>) and are unaffected.
 */
function rootCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const host = window.location.hostname
  return host.endsWith('theruff.agency') ? '.theruff.agency' : undefined
}

const domain = rootCookieDomain()

export const supabase = createBrowserClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookieOptions: {
      path:     '/',
      sameSite: 'lax',
      secure:   typeof window !== 'undefined' && window.location.protocol === 'https:',
      // Only set domain when on the root domain, so it stays host-scoped on
      // localhost / preview (exactOptionalPropertyTypes: no explicit undefined).
      ...(domain ? { domain } : {}),
    },
  },
)
