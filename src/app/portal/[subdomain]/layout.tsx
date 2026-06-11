'use client'

import { use, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PortalShell from '@/components/portal/PortalShell'
import type { PortalOwnerBranding } from '@/types/crm'

interface PortalSession {
  clientName: string
  branding: PortalOwnerBranding
}

const PUBLIC_PATHS = ['/login', '/signup']

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

  const isPublic = PUBLIC_PATHS.some((p) => pathname.endsWith(p))

  useEffect(() => {
    void (async () => {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) {
        setLoading(false)
        if (!isPublic) router.replace(`/portal/${subdomain}/login`)
        return
      }
      const token = authSession.access_token

      // Verify portal session via API (confirms this is a portal user, not an owner account)
      const res = await fetch('/api/v1/portal/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        await supabase.auth.signOut()
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
