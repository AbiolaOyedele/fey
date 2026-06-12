'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The client-facing workspace sections, in the same order as the owner's
 * ContactTabs. Each maps to an existing /portal/[subdomain]/<path> route.
 * Exported so PortalShell can decide when to show the tab bar.
 */
export const PORTAL_SECTIONS: { label: string; path: string }[] = [
  { label: 'Messages',  path: '/messages' },
  { label: 'Files',     path: '/files' },
  { label: 'Contracts', path: '/contracts' },
  { label: 'Forms',     path: '/forms' },
  { label: 'Payments',  path: '/payments' },
  { label: 'Invoices',  path: '/invoices' },
  { label: 'Tasks',     path: '/tasks' },
]

interface PortalWorkspaceTabsProps {
  subdomain: string
  accent:    string
}

/**
 * Horizontal tab bar shown across the portal workspace sections — the client's
 * equivalent of the owner's ContactTabs. Lets the client move between every
 * section the owner can send items to (messages, files, contracts, forms,
 * payments, invoices, tasks).
 */
export default function PortalWorkspaceTabs({ subdomain, accent }: PortalWorkspaceTabsProps) {
  const pathname = usePathname() ?? ''
  const base = `/portal/${subdomain}`

  return (
    <div
      className="flex items-center gap-0 overflow-x-auto border-b bg-white flex-shrink-0"
      style={{ borderColor: '#EBEBEB' }}
    >
      {PORTAL_SECTIONS.map(({ label, path }) => {
        const href = `${base}${path}`
        const isActive = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={path}
            href={href}
            className="flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: isActive ? accent : 'transparent',
              color:       isActive ? '#111827' : 'rgba(0,0,0,0.40)',
            }}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
