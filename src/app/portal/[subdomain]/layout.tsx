'use client'

import { use, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import PortalShell from '@/components/portal/PortalShell'
import type { PortalOwnerBranding } from '@/types/crm'

interface PortalSession {
  clientName: string
  branding: PortalOwnerBranding
}

const PUBLIC_PATHS = ['/login', '/signup', '/join']

/** localStorage key for the portal JWT — scoped to each workspace slug */
export function portalTokenKey(workspaceSlug: string) {
  return `portal_token_${workspaceSlug}`
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

  const [session,  setSession]  = useState<PortalSession | null>(null)
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
        if (!isPublic) router.replace(`/portal/${subdomain}/login`)
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
        if (!isPublic) router.replace(`/portal/${subdomain}/login`)
        return
      }

      const data = await res.json() as { name: string; branding: PortalOwnerBranding }
      setSession({ clientName: data.name, branding: data.branding })
      setLoading(false)
    })()
  }, [subdomain, isPublic, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (isPublic) {
    return <>{children}</>
  }

  if (!session) return null

  return (
    <PortalShell
      subdomain={subdomain}
      branding={session.branding}
      clientName={session.clientName}
    >
      {children}
    </PortalShell>
  )
}
