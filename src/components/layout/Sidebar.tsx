'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CreditCard, Settings,
  ListTodo, FileText, Sparkles,
} from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { IS_DEMO } from '@/lib/constants'
import NotificationBell from '@/components/crm/NotificationBell'

interface NavItemProps {
  href: string
  title: string
  children: React.ReactNode
  exact?: boolean
  accent: string
  /** When true, renders at 70% opacity while inactive and fades to full on hover */
  subtle?: boolean | undefined
}

function NavItem({ href, title, children, exact = false, accent, subtle }: NavItemProps) {
  const pathname  = usePathname() ?? ''
  const isActive  = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      title={title}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
        isActive
          ? ''
          : `text-gray-400 hover:text-gray-700 hover:bg-gray-50 ${subtle ? 'opacity-70 hover:opacity-100' : ''}`
      }`}
      style={isActive ? { backgroundColor: `${accent}15`, color: accent } : {}}
    >
      {children}
    </Link>
  )
}

interface MobileLinkProps {
  href: string
  children: React.ReactNode
  exact?: boolean
  accent: string
  badge?: boolean
}

function MobileLink({ href, children, exact = false, accent, badge = false }: MobileLinkProps) {
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
      {badge && (
        <span
          className="absolute top-1 right-1 w-2 h-2 rounded-full"
          style={{ backgroundColor: accent }}
        />
      )}
    </Link>
  )
}

export default function Sidebar() {
  const { settings } = useSettings()
  const accent   = settings.accent_color || '#ED64A6'
  const appMode  = settings.app_mode || 'dual'
  const topClass = IS_DEMO ? 'top-8' : 'top-0'

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex fixed left-0 ${topClass} bottom-0 w-[72px] bg-white border-r border-gray-100 flex-col items-center z-10`}>
        <Link href="/" className="pt-5 pb-4">
          {settings.logo ? (
            <Image
              src={settings.logo}
              alt="Logo"
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl object-contain bg-white p-0.5"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
          )}
        </Link>

        <nav className="flex-1 flex flex-col items-center gap-2 pt-2">
          <NavItem href="/"         title="Dashboard" exact accent={accent}><LayoutDashboard size={20} /></NavItem>

          {appMode !== 'tasks' && (
            <NavItem href="/clients" title={settings.clients_label || 'Clients'} accent={accent}>
              <Users size={20} />
            </NavItem>
          )}

          {appMode !== 'clients' && (
            <NavItem href="/tasks" title="Tasks" accent={accent}><ListTodo size={20} /></NavItem>
          )}

          <NavItem href="/payments" title="Payments" accent={accent}><CreditCard size={20} /></NavItem>
          <NavItem href="/invoices" title="Invoices" accent={accent}><FileText size={20} /></NavItem>
          <NavItem href="/fey"      title="Fey"      accent={accent} subtle><Sparkles size={20} /></NavItem>
        </nav>

        <div className="pb-5 pt-3 border-t border-gray-100 flex flex-col items-center gap-3">
          <NotificationBell accent={accent} />
          <NavItem href="/settings" title="Settings" accent={accent}><Settings size={20} /></NavItem>
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
