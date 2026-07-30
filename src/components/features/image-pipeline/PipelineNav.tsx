'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, Images, Coins, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const BASE = '/playground/image-pipeline'

interface Tab {
  href: string
  label: string
  icon: LucideIcon
}

const TABS: Tab[] = [
  { href: BASE, label: 'Generate', icon: Sparkles },
  { href: `${BASE}/gallery`, label: 'Gallery', icon: Images },
  { href: `${BASE}/credits`, label: 'Credits', icon: Coins },
]

/**
 * Sub-navigation for the Image Pipeline corner. Horizontally scrollable on
 * mobile so tabs never wrap or clip; the Admin tab appears only for admins.
 */
export default function PipelineNav({ showAdmin, accent }: { showAdmin: boolean; accent: string }) {
  const pathname = usePathname() ?? ''
  const tabs = showAdmin ? [...TABS, { href: `${BASE}/admin`, label: 'Admin', icon: ShieldCheck }] : TABS

  return (
    <nav className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none" aria-label="Image Pipeline sections">
      {tabs.map((tab) => {
        const active = tab.href === BASE ? pathname === BASE : pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 h-11 text-xs font-medium transition-colors ${
              active ? 'text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
            style={active ? { backgroundColor: accent } : undefined}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={14} />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
