'use client'

import posthog from 'posthog-js'
import { env } from '@/config/env'

let initialized = false

/** Initializes posthog-js once. No-op when NEXT_PUBLIC_POSTHOG_KEY is unset. */
export function initPostHog(): void {
  if (initialized || typeof window === 'undefined') return
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false, // captured manually on route change — see PostHogPageview
    person_profiles: 'identified_only',
  })
  initialized = true
}

export { posthog }
