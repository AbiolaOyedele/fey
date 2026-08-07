'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PortalOwnerBranding, PortalUser } from '@/types/crm'

/**
 * The portal session, resolved once by the layout and shared with every page.
 *
 * The layout already fetches all of this to verify the token. Pages that fetched
 * it again were paying a round-trip per navigation — and branding arriving late
 * meant the whole portal painted in the default accent before repainting in the
 * workspace's real colour. One resolve, one paint.
 *
 * Pages outside the layout (login, signup, join) have no session yet; the hooks
 * return null there and callers fall back.
 */
export interface PortalSession {
  portalUser: PortalUser
  branding:   PortalOwnerBranding
  clientName: string
  /**
   * Whether the owner has switched the Progress panel on for this client.
   * Resolved once with the session so the Tasks page can decide whether the
   * tab exists at all, rather than showing one that fetches a 403.
   */
  insightsEnabled: boolean
}

interface SessionValue {
  session: PortalSession
  /** Applies a local change (e.g. the client renamed themselves) without a refetch. */
  setPortalUser: (user: PortalUser) => void
}

const Ctx = createContext<SessionValue | null>(null)

export function PortalSessionProvider({
  session,
  children,
}: {
  session: PortalSession
  children: ReactNode
}) {
  const [portalUser, setPortalUser] = useState<PortalUser>(session.portalUser)
  return (
    <Ctx.Provider value={{ session: { ...session, portalUser }, setPortalUser }}>
      {children}
    </Ctx.Provider>
  )
}

/** The full session, or null outside the provider. */
export function usePortalSession(): SessionValue | null {
  return useContext(Ctx)
}

/** Branding from the layout, or null outside the provider. */
export function usePortalBrandingContext(): PortalOwnerBranding | null {
  return useContext(Ctx)?.session.branding ?? null
}
