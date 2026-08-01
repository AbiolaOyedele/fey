'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Tab {
  label: string
  href: string
}

interface ContactTabsProps {
  contactId: string
}

export default function ContactTabs({ contactId }: ContactTabsProps) {
  const pathname = usePathname() ?? ''
  const base = `/clients/${contactId}`

  /**
   * Tasks leads — it's the thing most often being checked. Files, Contracts,
   * Forms, Payments and Invoices now live behind one Documents tab; their pages
   * are unchanged, they're just reached from there instead of from five tabs
   * that overflowed the bar on any phone.
   */
  const tabs: Tab[] = [
    { label: 'Tasks',           href: `${base}/tasks` },
    { label: 'Messages',        href: `${base}/messages` },
    { label: 'Brands',          href: `${base}/projects` },
    { label: 'Documents',       href: `${base}/documents` },
    { label: 'Members',         href: `${base}/portal-members` },
    { label: 'Portal Settings', href: `${base}/portal-settings` },
  ]

  /** Sub-pages that should keep the Documents tab lit while they're open. */
  const DOCUMENT_PATHS = ['/files', '/contracts', '/forms', '/payments', '/invoices']

  return (
    <div className="flex items-center gap-0 overflow-x-auto border-b border-gray-100 bg-white scrollbar-none">
      {tabs.map((tab) => {
        const isDocuments = tab.href.endsWith('/documents')
        const isActive =
          pathname === tab.href ||
          pathname.startsWith(`${tab.href}/`) ||
          (isDocuments && DOCUMENT_PATHS.some((p) => pathname.startsWith(`${base}${p}`)))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-[color:var(--accent,#ED64A6)] text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
