'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CreditCard, Settings,
  ListTodo, FileText, Sparkles, ChevronsLeft, ChevronsRight,
  MessagesSquare, UsersRound, ShieldCheck, FolderKanban, Bell,
} from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { IS_DEMO } from '@/lib/constants'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import FeedbackButton from '@/components/ui/FeedbackButton'
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
  // The Admin link only surfaces on the personal admin host (feyadmin.*). The
  // /admin page + its API still enforce the email allowlist, so this is just
  // visibility — ADMIN_EMAILS isn't readable client-side anyway.
  const [onAdminHost, setOnAdminHost] = useState(false)
  useEffect(() => {
    setOnAdminHost(typeof window !== 'undefined' && window.location.hostname.startsWith('feyadmin.'))
  }, [])
  const accent   = settings.accent_color || '#ED64A6'
  const appMode  = settings.app_mode || 'dual'
  const topClass = IS_DEMO ? 'top-8' : 'top-0'
  const clientsLabel = settings.clients_label || 'Clients'

  // `expanded` = pinned open (persisted, shifts content). `hovering` = transient
  // hover-peek (overlay, doesn't shift content). `showExpanded` drives the visuals.
  const [expanded, setExpanded] = useState(false)
  const [hovering, setHovering] = useState(false)
  const showExpanded = expanded || hovering

  useEffect(() => {
    try { if (localStorage.getItem(SIDEBAR_KEY) === 'true') setExpanded(true) } catch { /* unavailable */ }
  }, [])
  // Only the pinned width shifts content — hover-peek floats over it.
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
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={`hidden lg:flex fixed left-0 ${topClass} bottom-0 bg-white border-r border-gray-100 flex-col z-20 transition-[width] duration-200 ${
          showExpanded ? 'w-[216px] px-3 items-stretch' : 'w-[72px] items-center'
        } ${hovering && !expanded ? 'shadow-2xl' : ''}`}
      >
        {/* Logo */}
        <Link href="/" className={`flex items-center gap-2.5 pt-5 pb-4 ${showExpanded ? 'px-1' : 'justify-center'}`}>
          {settings.logo ? (
            <Image
              src={settings.logo}
              alt="Logo"
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 flex-shrink-0"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/favicon.svg" alt="Logo" className="w-10 h-10 rounded-xl object-contain flex-shrink-0" />
          )}
          {showExpanded && (
            <span className="font-semibold text-gray-900 truncate">{settings.company_name || 'Fey'}</span>
          )}
        </Link>

        <nav className={`flex-1 flex flex-col gap-1 pt-2 ${showExpanded ? 'items-stretch' : 'items-center'}`}>
          <NavItem href="/" label="Dashboard" exact accent={accent} expanded={showExpanded} icon={<LayoutDashboard size={20} />} />

          {appMode !== 'tasks' && (
            <NavItem href="/clients" label={clientsLabel} accent={accent} expanded={showExpanded} icon={<Users size={20} />} />
          )}

          {appMode !== 'clients' && (
            <NavItem href="/tasks" label="Tasks" accent={accent} expanded={showExpanded} icon={<ListTodo size={20} />} />
          )}

          <NavItem href="/projects" label="Projects" accent={accent} expanded={showExpanded} icon={<FolderKanban size={20} />} />
          <NavItem href="/payments" label="Payments" accent={accent} expanded={showExpanded} icon={<CreditCard size={20} />} />
          <NavItem href="/invoices" label="Invoices" accent={accent} expanded={showExpanded} icon={<FileText size={20} />} />
          <NavItem href="/playground" label="Internal Chats" accent={accent} expanded={showExpanded} icon={<MessagesSquare size={20} />} />
          <NavItem href="/team" label="Team" accent={accent} expanded={showExpanded} icon={<UsersRound size={20} />} />
          <NavItem href="/fey" label="Fey" accent={accent} expanded={showExpanded} subtle icon={<Sparkles size={20} />} />
        </nav>

        <div className={`pb-3 pt-3 border-t border-gray-100 flex flex-col gap-2 ${showExpanded ? 'items-stretch' : 'items-center'}`}>
          {showExpanded && <WorkspaceSwitcher accent={accent} />}
          {onAdminHost && (
            <NavItem href="/admin" label="Admin" accent={accent} expanded={showExpanded} icon={<ShieldCheck size={20} />} />
          )}
          {!IS_DEMO && <NotificationBell accent={accent} />}
          {!IS_DEMO && <FeedbackButton expanded={showExpanded} />}
          <NavItem href="/settings" label="Settings" accent={accent} expanded={showExpanded} icon={<Settings size={20} />} />
          <button
            onClick={toggle}
            title={expanded ? 'Collapse sidebar' : 'Keep sidebar open'}
            className={`flex items-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${
              showExpanded ? 'w-full gap-3 px-3 h-10' : 'w-10 h-10 justify-center'
            }`}
          >
            <span className="flex-shrink-0">{expanded ? <ChevronsLeft size={20} /> : <ChevronsRight size={20} />}</span>
            {showExpanded && <span className="text-sm font-medium">{expanded ? 'Collapse' : 'Keep open'}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around gap-1 px-1 overflow-x-auto scrollbar-none z-20 lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '4rem' }}
      >
        <MobileLink href="/" exact accent={accent}><LayoutDashboard size={22} /></MobileLink>

        {appMode !== 'tasks' && (
          <MobileLink href="/clients" accent={accent}><Users size={22} /></MobileLink>
        )}

        {appMode !== 'clients' && (
          <MobileLink href="/tasks" accent={accent}><ListTodo size={22} /></MobileLink>
        )}

        <MobileLink href="/projects" accent={accent}><FolderKanban size={22} /></MobileLink>
        <MobileLink href="/payments" accent={accent}><CreditCard size={22} /></MobileLink>
        <MobileLink href="/playground" accent={accent}><MessagesSquare size={22} /></MobileLink>
        <MobileLink href="/team"     accent={accent}><UsersRound size={22} /></MobileLink>
        <MobileLink href="/notifications" accent={accent}><Bell size={22} /></MobileLink>
        <MobileLink href="/fey"      accent={accent}><Sparkles size={22} /></MobileLink>
        <MobileLink href="/settings" accent={accent}><Settings size={22} /></MobileLink>
      </nav>
    </>
  )
}
