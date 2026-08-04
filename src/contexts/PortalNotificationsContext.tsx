'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { usePortalNotifications, type PortalNotificationsState } from '@/hooks/usePortalNotifications'

/**
 * One notification feed for the whole portal.
 *
 * The bug this fixes: the shell's bell badge and the notifications page each
 * called `usePortalNotifications` themselves, so they held two independent
 * copies of the same feed. Opening three of four notifications marked them read
 * in the page's copy and left the badge stuck on four until the next 60-second
 * poll — which reads as "the counter is broken", because it is.
 *
 * Resolving the feed once in the layout and sharing it means marking one read
 * moves both, in the same tick.
 */
const Ctx = createContext<PortalNotificationsState | null>(null)

export function PortalNotificationsProvider({
  subdomain,
  children,
}: {
  subdomain: string
  children: ReactNode
}) {
  const value = usePortalNotifications(subdomain)
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * The shared feed. Falls back to an empty, inert feed outside the provider
 * (login / signup / join render without a session), so callers never branch.
 */
export function usePortalNotificationFeed(): PortalNotificationsState {
  return useContext(Ctx) ?? EMPTY
}

const noop = async () => {}

const EMPTY: PortalNotificationsState = {
  notifications: [],
  unread: 0,
  loading: false,
  refresh: noop,
  markRead: noop,
  markAllRead: noop,
}
