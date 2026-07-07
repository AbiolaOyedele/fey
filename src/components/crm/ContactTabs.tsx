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

  const tabs: Tab[] = [
    { label: 'Messages',        href: `${base}/messages` },
    { label: 'Brands',          href: `${base}/projects` },
    { label: 'Files',           href: `${base}/files` },
    { label: 'Contracts',       href: `${base}/contracts` },
    { label: 'Forms',           href: `${base}/forms` },
    { label: 'Payments',        href: `${base}/payments` },
    { label: 'Invoices',        href: `${base}/invoices` },
    { label: 'Tasks',           href: `${base}/tasks` },
    { label: 'Portal Settings', href: `${base}/portal-settings` },
  ]

  return (
    <div className="flex items-center gap-0 overflow-x-auto border-b border-gray-100 bg-white">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
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
