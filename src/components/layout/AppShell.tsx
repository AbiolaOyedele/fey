'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { IS_DEMO } from '@/lib/constants'
import { env } from '@/config/env'
import Sidebar from './Sidebar'
import ToastContainer from '@/components/ui/Toast'
import UpdateBanner from '@/components/ui/UpdateBanner'
import { useUpdatePrompt } from '@/hooks/useUpdatePrompt'

// /onboarding is Workboard's route — Fey uses /setup to avoid clashing.
// Both apps share the same Next.js codebase and Supabase DB.
const PUBLIC_ROUTES = ['/login', '/register', '/onboarding', '/setup']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const router   = useRouter()
  const { user, loading: authLoading }               = useAuth()
  const { settings, settingsLoading } = useSettings()
  const updateAvailable = useUpdatePrompt()

  const isPublic = PUBLIC_ROUTES.includes(pathname)
    || pathname.startsWith('/auth/')
    || pathname.startsWith('/team/accept')
    || pathname.startsWith('/share/')
    || pathname.startsWith('/invoice/')
    || pathname.startsWith('/portal/')
    || pathname.startsWith('/pay/')

  const loading = authLoading || settingsLoading

  // Setup is considered done when either:
  //   (a) the user has a workspace_slug in the DB — set during /setup, the
  //       most reliable signal since fey_onboarding_complete may be null for
  //       users who completed setup before that column was added, or
  //   (b) the in-memory flag is 'true' (covers the instant after finishSetup
  //       calls saveSetting before the next full DB reload).
  const setupComplete = !!settings.workspace_slug || settings.fey_onboarding_complete === 'true'

  useEffect(() => {
    if (IS_DEMO || isPublic || loading) return
    if (!user) { router.replace('/login'); return }
    if (!setupComplete) { router.replace('/setup') }
  }, [user, loading, isPublic, setupComplete, router])

  // Keep the owner on their own workspace subdomain (<slug>.theruff.agency).
  // Cookie SSO carries the session across subdomains, so this is a seamless hard
  // redirect. Skipped on localhost / preview (non-root hosts) and on the portal.
  useEffect(() => {
    if (IS_DEMO || isPublic || loading || !user || !setupComplete) return
    if (typeof window === 'undefined') return
    const slug = settings.workspace_slug
    if (!slug) return
    const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency'
    const host = window.location.hostname
    if (!host.endsWith(rootDomain)) return       // localhost / *.vercel.app
    if (host === `${slug}.${rootDomain}`) return  // already on the right subdomain
    window.location.href = `https://${slug}.${rootDomain}${window.location.pathname}${window.location.search}`
  }, [user, loading, isPublic, setupComplete, settings.workspace_slug])

  if (isPublic) return <>{children}</>

  if (!IS_DEMO && loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-appbg">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!IS_DEMO && !user) return null
  if (!IS_DEMO && !setupComplete) return null

  return (
    <div className="flex flex-col min-h-screen bg-appbg overflow-x-hidden">
      <div className="flex flex-1 overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 ml-0 lg:ml-[var(--sidebar-w,72px)] pb-16 lg:pb-0 page-enter transition-[margin] duration-200">
          {children}
        </main>
      </div>
      <ToastContainer />
      <UpdateBanner show={updateAvailable} accent={settings.accent_color} />
    </div>
  )
}
