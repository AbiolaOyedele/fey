'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CreditCard, Settings,
  ListTodo, FileText, Sparkles, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { IS_DEMO } from '@/lib/constants'
import NotificationBell from '@/components/crm/NotificationBell'

const SIDEBAR_KEY = 'fey:sidebar_expanded'

interface NavItemProps {
  href: string
  label: string
  icon: React.ReactNode
  expanded: boolean
  accent: string
  exact?: boolean
  /** When true, renders at 70% opacity while inactive and fades to full on hover */
  subtle?: boolean | undefined
}

function NavItem({ href, label, icon, expanded, accent, exact = false, subtle }: NavItemProps) {
  const pathname  = usePathname() ?? ''
  const isActive  = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      title={expanded ? undefined : label}
      className={`flex items-center rounded-xl transition-all duration-200 ${
        expanded ? 'w-full gap-3 px-3 h-10' : 'w-10 h-10 justify-center'
      } ${
        isActive
          ? ''
          : `text-gray-400 hover:text-gray-700 hover:bg-gray-50 ${subtle ? 'opacity-70 hover:opacity-100' : ''}`
      }`}
      style={isActive ? { backgroundColor: `${accent}15`, color: accent } : {}}
    >
      <span className="flex-shrink-0">{icon}</span>
      {expanded && <span className="text-sm font-medium truncate">{label}</span>}
    </Link>
  )
}

interface MobileLinkProps {
  href: string
  children: React.ReactNode
  exact?: boolean
  accent: string
}

function MobileLink({ href, children, exact = false, accent }: MobileLinkProps) {
  const pathname = usePathname() ?? ''
  const isActive = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${
        isActive ? '' : 'text-gray-400'
      }`}
      style={isActive ? { color: accent } : {}}
    >
      {children}
    </Link>
  )
}

export default function Sidebar() {
  const { settings } = useSettings()
  const accent   = settings.accent_color || '#ED64A6'
  const appMode  = settings.app_mode || 'dual'
  const topClass = IS_DEMO ? 'top-8' : 'top-0'
  const clientsLabel = settings.clients_label || 'Clients'

  const [expanded, setExpanded] = useState(false)

  // Restore the pinned state, then keep a CSS var in sync so AppShell's main
  // content margin follows the sidebar width.
  useEffect(() => {
    try { if (localStorage.getItem(SIDEBAR_KEY) === 'true') setExpanded(true) } catch { /* unavailable */ }
  }, [])
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', expanded ? '216px' : '72px')
  }, [expanded])

  const toggle = () => {
    setExpanded((v) => {
      const next = !v
      try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch { /* unavailable */ }
      return next
    })
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed left-0 ${topClass} bottom-0 bg-white border-r border-gray-100 flex-col z-10 transition-[width] duration-200 ${
          expanded ? 'w-[216px] px-3 items-stretch' : 'w-[72px] items-center'
        }`}
      >
        {/* Logo */}
        <Link href="/" className={`flex items-center gap-2.5 pt-5 pb-4 ${expanded ? 'px-1' : 'justify-center'}`}>
          {settings.logo ? (
            <Image
              src={settings.logo}
              alt="Logo"
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">F</span>
            </div>
          )}
          {expanded && (
            <span className="font-semibold text-gray-900 truncate">{settings.company_name || 'Fey'}</span>
          )}
        </Link>

        <nav className={`flex-1 flex flex-col gap-1 pt-2 ${expanded ? 'items-stretch' : 'items-center'}`}>
          <NavItem href="/" label="Dashboard" exact accent={accent} expanded={expanded} icon={<LayoutDashboard size={20} />} />

          {appMode !== 'tasks' && (
            <NavItem href="/clients" label={clientsLabel} accent={accent} expanded={expanded} icon={<Users size={20} />} />
          )}

          {appMode !== 'clients' && (
            <NavItem href="/tasks" label="Tasks" accent={accent} expanded={expanded} icon={<ListTodo size={20} />} />
          )}

          <NavItem href="/payments" label="Payments" accent={accent} expanded={expanded} icon={<CreditCard size={20} />} />
          <NavItem href="/invoices" label="Invoices" accent={accent} expanded={expanded} icon={<FileText size={20} />} />
          <NavItem href="/fey" label="Fey" accent={accent} expanded={expanded} subtle icon={<Sparkles size={20} />} />
        </nav>

        <div className={`pb-3 pt-3 border-t border-gray-100 flex flex-col gap-2 ${expanded ? 'items-stretch' : 'items-center'}`}>
          <div className={expanded ? 'px-1' : ''}>
            <NotificationBell accent={accent} />
          </div>
          <NavItem href="/settings" label="Settings" accent={accent} expanded={expanded} icon={<Settings size={20} />} />
          <button
            onClick={toggle}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            className={`flex items-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${
              expanded ? 'w-full gap-3 px-3 h-10' : 'w-10 h-10 justify-center'
            }`}
          >
            <span className="flex-shrink-0">{expanded ? <ChevronsLeft size={20} /> : <ChevronsRight size={20} />}</span>
            {expanded && <span className="text-sm font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around z-20 lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '4rem' }}
      >
        <MobileLink href="/" exact accent={accent}><LayoutDashboard size={22} /></MobileLink>

        {appMode !== 'tasks' && (
          <MobileLink href="/clients" accent={accent}><Users size={22} /></MobileLink>
        )}

        {appMode !== 'clients' && (
          <MobileLink href="/tasks" accent={accent}><ListTodo size={22} /></MobileLink>
        )}

        <MobileLink href="/payments" accent={accent}><CreditCard size={22} /></MobileLink>
        <MobileLink href="/invoices" accent={accent}><FileText size={22} /></MobileLink>
        <MobileLink href="/fey"      accent={accent}><Sparkles size={22} /></MobileLink>
        <MobileLink href="/settings" accent={accent}><Settings size={22} /></MobileLink>
      </nav>
    </>
  )
}
