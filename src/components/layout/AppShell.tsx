'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { IS_DEMO } from '@/lib/constants'
import { env } from '@/config/env'
import Sidebar from './Sidebar'
import ToastContainer from '@/components/ui/Toast'
import UpdateBanner from '@/components/ui/UpdateBanner'
import { useUpdatePrompt } from '@/hooks/useUpdatePrompt'
import { useWorkspace } from '@/hooks/useWorkspace'
import { activeWorkspaceSlug } from '@/utils/host'

// /onboarding is Workboard's route — Fey uses /setup to avoid clashing.
// Both apps share the same Next.js codebase and Supabase DB.
const PUBLIC_ROUTES = ['/login', '/register', '/onboarding', '/setup']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const router   = useRouter()
  const { user, loading: authLoading }               = useAuth()
  const { settings, settingsLoading } = useSettings()
  const { workspace, memberships, loading: workspaceLoading, refetch: refetchWorkspace } = useWorkspace()
  const updateAvailable = useUpdatePrompt()

  // A teammate who signed up via an invite link has a stashed token. Consume it
  // once they're authenticated so they join the workspace instead of being sent
  // to /setup. Bounded: the token is cleared after one attempt (success or not).
  const [inviteResolving, setInviteResolving] = useState(false)
  useEffect(() => {
    if (!user || workspace || inviteResolving) return
    let token: string | null = null
    try { token = localStorage.getItem('fey:pending_invite') } catch { /* unavailable */ }
    if (!token) return
    setInviteResolving(true)
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/v1/team/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
          body: JSON.stringify({ token }),
        })
      } catch { /* invalid/expired — fall through to normal onboarding */ }
      finally {
        try { localStorage.removeItem('fey:pending_invite') } catch { /* unavailable */ }
        refetchWorkspace()
        setInviteResolving(false)
      }
    })()
  }, [user, workspace, inviteResolving, refetchWorkspace])

  const isPublic = PUBLIC_ROUTES.includes(pathname)
    || pathname.startsWith('/auth/')
    || pathname.startsWith('/team/accept')
    || pathname.startsWith('/share/')
    || pathname.startsWith('/invoice/')
    || pathname.startsWith('/portal/')
    || pathname.startsWith('/pay/')

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
    if (IS_DEMO || isPublic || loading || inviteResolving) return
    if (!user) { router.replace('/login'); return }
    if (!setupComplete) { router.replace('/setup') }
  }, [user, loading, isPublic, setupComplete, inviteResolving, router])

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
