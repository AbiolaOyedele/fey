'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { IS_DEMO } from '@/lib/constants'
import Sidebar from './Sidebar'
import ToastContainer from '@/components/ui/Toast'

const PUBLIC_ROUTES = ['/login', '/register', '/onboarding']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const router   = useRouter()
  const { user, loading: authLoading }             = useAuth()
  const { settings, settingsLoading } = useSettings()

  const isPublic = PUBLIC_ROUTES.includes(pathname)
    || pathname.startsWith('/share/')
    || pathname.startsWith('/invoice/')
    || pathname.startsWith('/portal/')
    || pathname.startsWith('/pay/')

  const loading = authLoading || settingsLoading

  useEffect(() => {
    if (IS_DEMO || isPublic || loading) return

    // Not logged in → login page
    if (!user) {
      router.replace('/login')
      return
    }

    // Logged in but hasn't chosen a workspace slug yet → onboarding
    if (settings.onboarding_complete !== 'true') {
      router.replace('/onboarding')
    }
  }, [user, loading, isPublic, settings.onboarding_complete, router])

  if (isPublic) return <>{children}</>

  if (!IS_DEMO && loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-appbg">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!IS_DEMO && !user) return null

  // Don't render the dashboard shell while onboarding redirect is in-flight
  if (!IS_DEMO && settings.onboarding_complete !== 'true') return null

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
