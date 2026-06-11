'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { IS_DEMO } from '@/lib/constants'
import Sidebar from './Sidebar'
import ToastContainer from '@/components/ui/Toast'

const PUBLIC_ROUTES = ['/login', '/register', '/onboarding']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const router   = useRouter()
  const { user, loading } = useAuth()

  const isPublic = PUBLIC_ROUTES.includes(pathname)
    || pathname.startsWith('/share/')
    || pathname.startsWith('/invoice/')
    || pathname.startsWith('/portal/')
    || pathname.startsWith('/pay/')

  // Redirect unauthenticated users to /login for protected routes.
  // Skip in demo mode — demo has no real auth.
  useEffect(() => {
    if (IS_DEMO || isPublic || loading) return
    if (!user) router.replace('/login')
  }, [user, loading, isPublic, router])

  if (isPublic) return <>{children}</>

  // Show nothing while auth resolves to avoid flash of protected content
  if (!IS_DEMO && loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-appbg">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
      </div>
    )
  }

  // Don't render protected shell if not authenticated (redirect is in-flight)
  if (!IS_DEMO && !user) return null

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
