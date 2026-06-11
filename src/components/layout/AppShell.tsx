'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { IS_DEMO } from '@/lib/constants'
import Sidebar from './Sidebar'
import ToastContainer from '@/components/ui/Toast'

// /onboarding is Workboard's route — Fey uses /setup to avoid clashing.
// Both apps share the same Next.js codebase and Supabase DB.
const PUBLIC_ROUTES = ['/login', '/register', '/onboarding', '/setup']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const router   = useRouter()
  const { user, loading: authLoading }               = useAuth()
  const { settings, settingsLoading } = useSettings()

  const isPublic = PUBLIC_ROUTES.includes(pathname)
    || pathname.startsWith('/share/')
    || pathname.startsWith('/invoice/')
    || pathname.startsWith('/portal/')
    || pathname.startsWith('/pay/')

  const loading = authLoading || settingsLoading

  useEffect(() => {
    if (IS_DEMO || isPublic || loading) return
    if (!user) { router.replace('/login'); return }

    // Fey-specific onboarding check. Uses fey_onboarding_complete, NOT
    // onboarding_complete — Workboard owns that flag. This way the two apps
    // never interfere with each other's onboarding flow.
    if (settings.fey_onboarding_complete !== 'true') {
      router.replace('/setup')
    }
  }, [user, loading, isPublic, settings.fey_onboarding_complete, router])

  if (isPublic) return <>{children}</>

  if (!IS_DEMO && loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-appbg">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!IS_DEMO && !user) return null
  if (!IS_DEMO && settings.fey_onboarding_complete !== 'true') return null

  return (
    <div className="flex flex-col min-h-screen bg-appbg overflow-x-hidden">
      <div className="flex flex-1 overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 ml-0 lg:ml-[72px] pb-16 lg:pb-0 page-enter">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
