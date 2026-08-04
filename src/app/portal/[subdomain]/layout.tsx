'use client'

import { use, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import PortalShell from '@/components/portal/PortalShell'
import { PortalSessionProvider } from '@/contexts/PortalSessionContext'
import { PortalNotificationsProvider } from '@/contexts/PortalNotificationsContext'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { portalBasePath } from '@/hooks/usePortalBase'
import type { PortalOwnerBranding, PortalUser } from '@/types/crm'

// Re-export so existing imports from this layout file keep working
export { portalTokenKey }

interface PortalSessionData {
  clientName: string
  branding:   PortalOwnerBranding
  portalUser: PortalUser
}

const PUBLIC_PATHS = ['/login', '/signup', '/join']

/**
 * Shown only for the moment before we know whether there's a session at all.
 * Deliberately not a full-screen spinner: the portal used to render nothing
 * until /auth/session came back, so every navigation into the portal began with
 * a blank second or two. This keeps the page structure on screen instead.
 */
function PortalSkeleton() {
  return (
    <div className="min-h-screen bg-appbg">
      <div className="h-14 border-b border-gray-100 bg-white" />
      <div className="p-4 md:p-6 lg:p-8 space-y-4 max-w-3xl">
        <div className="h-6 w-40 rounded-lg bg-gray-100 animate-pulse" />
        <div className="h-3 w-64 rounded bg-gray-50 animate-pulse" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = use(params)
  const router        = useRouter()
  const pathname      = usePathname()

  const [session,  setSession]  = useState<PortalSessionData | null>(null)
  const [loading,  setLoading]  = useState(true)

  // pathname ends with /login or /signup → no session required
  const isPublic = PUBLIC_PATHS.some((p) => pathname.endsWith(p))

  useEffect(() => {
    void (async () => {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem(portalTokenKey(subdomain))
        : null

      if (!token) {
        setLoading(false)
        if (!isPublic) router.replace(`${portalBasePath(subdomain)}/login`)
        return
      }

      // Verify portal session via API — confirms the JWT is valid and the user exists
      const res = await fetch('/api/v1/portal/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        // Token expired or invalid — clear and redirect to login
        localStorage.removeItem(portalTokenKey(subdomain))
        setLoading(false)
        if (!isPublic) router.replace(`${portalBasePath(subdomain)}/login`)
        return
      }

      const data = await res.json() as { name: string; branding: PortalOwnerBranding; portalUser: PortalUser }
      setSession({ clientName: data.name, branding: data.branding, portalUser: data.portalUser })
      setLoading(false)
    })()
  }, [subdomain, isPublic, router])

  // Public pages render immediately — they never needed the session check.
  if (isPublic) {
    return <>{children}</>
  }

  if (loading) return <PortalSkeleton />

  if (!session) return null

  return (
    <PortalSessionProvider
      session={{
        portalUser: session.portalUser,
        branding:   session.branding,
        clientName: session.clientName,
      }}
    >
      <PortalNotificationsProvider subdomain={subdomain}>
        <PortalShell
          subdomain={subdomain}
          branding={session.branding}
          clientName={session.clientName}
        >
          {children}
        </PortalShell>
      </PortalNotificationsProvider>
    </PortalSessionProvider>
  )
}
