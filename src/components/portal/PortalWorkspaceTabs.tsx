'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePortalBase } from '@/hooks/usePortalBase'

/**
 * The client-facing workspace sections, in the same order as the owner's
 * ContactTabs. Each maps to an existing /portal/[subdomain]/<path> route.
 * Exported so PortalShell can decide when to show the tab bar.
 */
/**
 * Tasks leads — it's what a client checks most. Files, Contracts, Forms,
 * Payments and Invoices sit behind one Documents tab: five tabs of paperwork
 * overflowed the bar on any phone, and they're all the same kind of thing.
 * Their pages are unchanged, only the way in.
 *
 * Note on `/projects`: the section is called **Brands** everywhere the client
 * can see. The route and the underlying table keep the old name so existing
 * links and data are untouched — this is a relabel, not a migration.
 */
export const PORTAL_SECTIONS: { label: string; path: string }[] = [
  { label: 'Tasks',     path: '/tasks' },
  { label: 'Messages',  path: '/messages' },
  { label: 'Private', path: '/team-chat' },
  { label: 'Brands',    path: '/projects' },
  { label: 'Documents', path: '/documents' },
]

/** Sub-pages that keep the Documents tab lit while they're open. */
export const PORTAL_DOCUMENT_PATHS = ['/files', '/contracts', '/forms', '/payments', '/invoices', '/vault']

/** Every section path, including the ones folded into Documents — used by the
 *  shell to decide when to show the tab bar at all. */
export const PORTAL_TAB_PATHS = [
  ...PORTAL_SECTIONS.map((s) => s.path),
  ...PORTAL_DOCUMENT_PATHS,
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
  const base = usePortalBase(subdomain)
  // Active-state from the section, stripping either base form (proxy-rewrite safe).
  const section = (pathname.replace(`/portal/${subdomain}`, '').replace(/^\/client/, '')) || '/'

  return (
    <div
      className="flex items-center gap-0 overflow-x-auto border-b bg-white flex-shrink-0 scrollbar-none"
      style={{ borderColor: '#EBEBEB' }}
    >
      {PORTAL_SECTIONS.map(({ label, path }) => {
        const href = `${base}${path}`
        const isActive =
          section === path ||
          section.startsWith(`${path}/`) ||
          (path === '/documents' && PORTAL_DOCUMENT_PATHS.some((p) => section.startsWith(p)))
        return (
          <Link
            key={path}
            href={href}
            className="flex-shrink-0 px-2.5 sm:px-4 h-12 inline-flex items-center text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
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
