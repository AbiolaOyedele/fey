'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { IS_DEMO } from '@/lib/constants'
import { env } from '@/config/env'
import Sidebar from './Sidebar'
import BrandLoader from '@/components/ui/BrandLoader'
import PwaRegister from '@/components/pwa/PwaRegister'
import AppNudges from '@/components/pwa/AppNudges'
import ToastContainer from '@/components/ui/Toast'
import UpdateBanner from '@/components/ui/UpdateBanner'
import { useUpdatePrompt } from '@/hooks/useUpdatePrompt'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator'
import { useWorkspace } from '@/hooks/useWorkspace'
import { activeWorkspaceSlug } from '@/utils/host'

const reloadPage = () => window.location.reload()

// /onboarding is Workboard's route — Fey uses /setup to avoid clashing.
// Both apps share the same Next.js codebase and Supabase DB.
const PUBLIC_ROUTES = ['/login', '/register', '/onboarding', '/setup', '/reset-password']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const router   = useRouter()
  const { user, loading: authLoading }               = useAuth()
  const { settings, settingsLoading } = useSettings()
  const { workspace, memberships, loading: workspaceLoading } = useWorkspace()
  const updateAvailable = useUpdatePrompt()
  const { pullDistance, refreshing } = usePullToRefresh(reloadPage)

  // A teammate who signed up via an invite link has a stashed token. Route them
  // to /team/accept (which prompts for their name, then joins) instead of the
  // owner /setup flow. The accept page itself handles consumption.
  const [hasPendingInvite, setHasPendingInvite] = useState(false)
  useEffect(() => {
    try { setHasPendingInvite(!!localStorage.getItem('fey:pending_invite')) } catch { /* unavailable */ }
  }, [user, workspace])

  const isPublic = PUBLIC_ROUTES.includes(pathname)
    || pathname.startsWith('/auth/')
    || pathname.startsWith('/team/accept')
    || pathname.startsWith('/share/')
    || pathname.startsWith('/invoice/')
    || pathname.startsWith('/portal/')
    || pathname.startsWith('/pay/')
    || pathname.startsWith('/admin')
    // Client-portal entry points — the proxy rewrites these to /portal/<slug>/*
    // but the browser path stays /join, /client-login, /client/*. They must be
    // public so AppShell doesn't drag clients into the owner /login + /setup flow.
    || pathname === '/join'
    || pathname.startsWith('/client-login')
    || pathname === '/client'
    || pathname.startsWith('/client/')

  const loading = authLoading || settingsLoading || workspaceLoading

  // Setup is considered done when either:
  //   (a) the user has a workspace_slug in the DB — set during /setup, the
  //       most reliable signal since fey_onboarding_complete may be null for
  //       users who completed setup before that column was added, or
  //   (b) the in-memory flag is 'true' (covers the instant after finishSetup
  //       calls saveSetting before the next full DB reload), or
  //   (c) the user is a member of a workspace — covers invited teammates, who
  //       join an existing workspace and never run /setup themselves.
  const setupComplete =
    !!settings.workspace_slug
    || settings.fey_onboarding_complete === 'true'
    || !!workspace

  useEffect(() => {
    if (IS_DEMO || isPublic || loading) return
    if (!user) { router.replace('/login'); return }
    // A pending invite takes priority over owner onboarding — send them to the
    // accept screen (name prompt + join) rather than /setup.
    if (!workspace && hasPendingInvite) { router.replace('/team/accept'); return }
    if (!setupComplete) { router.replace('/setup') }
  }, [user, loading, isPublic, setupComplete, workspace, hasPendingInvite, router])

  // Keep the user on a workspace subdomain (<slug>.theruff.agency). They may
  // belong to several workspaces; stay put on any one they're a member of (this
  // is what makes the switcher work). Only redirect from the apex / an
  // unaffiliated host to a sensible default. Cookie SSO carries the session.
  useEffect(() => {
    if (IS_DEMO || isPublic || loading || !user || !setupComplete) return
    if (typeof window === 'undefined') return
    const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'theruff.agency'
    const host = window.location.hostname
    if (!host.endsWith(rootDomain)) return       // localhost / *.vercel.app
    // The personal admin host serves the app normally — never redirect off it.
    if (host === `feyadmin.${rootDomain}`) return

    const memberSlugs = memberships.map((m) => m.workspace.slug).filter((s): s is string => !!s)
    const currentSlug = activeWorkspaceSlug()
    if (currentSlug && memberSlugs.includes(currentSlug)) return  // on one of my workspaces — stay

    const target = settings.workspace_slug ?? memberSlugs[0] ?? workspace?.slug
    if (!target) return
    if (host === `${target}.${rootDomain}`) return
    window.location.href = `https://${target}.${rootDomain}${window.location.pathname}${window.location.search}`
  }, [user, loading, isPublic, setupComplete, settings.workspace_slug, workspace?.slug, memberships])

  if (isPublic) return <>{children}</>

  if (!IS_DEMO && loading) {
    return <BrandLoader logo={settings.logo} fullscreen />
  }

  if (!IS_DEMO && !user) return null
  if (!IS_DEMO && !setupComplete) return null

  return (
    <div className="flex flex-col min-h-screen bg-appbg overflow-x-hidden">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} accent={settings.accent_color} />
      <div className="flex flex-1 overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 ml-0 lg:ml-[var(--sidebar-w,72px)] pb-16 lg:pb-0 page-enter transition-[margin] duration-200">
          {children}
        </main>
      </div>
      <ToastContainer />
      <PwaRegister />
      <AppNudges />
      <UpdateBanner show={updateAvailable} accent={settings.accent_color} />
    </div>
  )
}
