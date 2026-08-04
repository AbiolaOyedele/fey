'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Briefcase, Bell, Settings, Users, Menu, X, LogOut } from 'lucide-react'
import { portalTokenKey } from '@/app/portal/[subdomain]/layout'
import PortalWorkspaceTabs, { PORTAL_TAB_PATHS } from './PortalWorkspaceTabs'
import PortalFeedbackButton from './PortalFeedbackButton'
import UpdateBanner from '@/components/ui/UpdateBanner'
import { useUpdatePrompt } from '@/hooks/useUpdatePrompt'
import { useChunkErrorReload } from '@/hooks/useChunkErrorReload'
import { usePortalBase } from '@/hooks/usePortalBase'
import { usePortalNotificationFeed } from '@/contexts/PortalNotificationsContext'
import type { PortalOwnerBranding } from '@/types/crm'

interface PortalShellProps {
  subdomain:  string
  branding:   PortalOwnerBranding
  clientName: string
  children:   React.ReactNode
}

// Workspace sub-routes — all count as "Workspace" in the sidebar.
const WORKSPACE_ROUTES = ['/workspace', '/tasks', '/messages', '/projects', '/documents', '/files', '/contracts', '/forms', '/payments', '/invoices']

export default function PortalShell({ subdomain, branding, clientName, children }: PortalShellProps) {
  const pathname = usePathname() ?? ''
  const router   = useRouter()
  const [open, setOpen]             = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const base   = usePortalBase(subdomain)   // for link hrefs (/client or /portal/<slug>)
  const accent = branding.accent_color || '#ED64A6'
  const updateAvailable = useUpdatePrompt()
  const { unread } = usePortalNotificationFeed()
  useChunkErrorReload()

  // Active-state is derived from the section, stripping whichever base form the
  // pathname has (/portal/<slug>/X or /client/X) — robust to the proxy rewrite.
  const section = (pathname.replace(`/portal/${subdomain}`, '').replace(/^\/client/, '')) || '/'
  const isDashboard     = section === '/'
  const isWorkspace     = WORKSPACE_ROUTES.some((r) => section.startsWith(r))
  const isNotifications = section.startsWith('/notifications')
  const isSettings      = section.startsWith('/settings')
  const isMembers       = section.startsWith('/members')
  const showTabs        = PORTAL_TAB_PATHS.some((p) => section.startsWith(p))

  const signOut = () => {
    setSigningOut(true)
    localStorage.removeItem(portalTokenKey(subdomain))
    router.push(`${base}/login`)
  }

  // One object rather than a dozen props — the sidebar is rendered twice
  // (desktop + mobile drawer) and both need exactly the same state.
  const nav: SidebarProps = {
    base, accent, branding, clientName, subdomain, signingOut, unread,
    isDashboard, isWorkspace, isNotifications, isSettings, isMembers,
    onNavigate: () => setOpen(false),
    onSignOut: signOut,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Desktop sidebar */}
      <Sidebar {...nav} />

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-60">
            <Sidebar {...nav} mobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-white" style={{ borderColor: '#EBEBEB' }}>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="w-11 h-11 -ml-2 flex items-center justify-center text-gray-500"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-800 truncate flex-1">{branding.business_name}</span>
          <Link
            href={`${base}/notifications`}
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            className="relative w-11 h-11 -mr-2 flex items-center justify-center text-gray-500"
          >
            <Bell size={19} />
            {unread > 0 && (
              <span
                className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-semibold text-white flex items-center justify-center"
                style={{ backgroundColor: accent }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          {open && (
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="w-11 h-11 flex items-center justify-center text-gray-500">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Section tabs — the client's equivalent of the owner's ContactTabs */}
        {showTabs && <PortalWorkspaceTabs subdomain={subdomain} accent={accent} />}

        <main className="flex-1 overflow-y-auto bg-appbg">
          {children}
        </main>
      </div>

      <UpdateBanner show={updateAvailable} accent={accent} />
    </div>
  )
}

interface SidebarProps {
  base: string
  accent: string
  branding: PortalOwnerBranding
  clientName: string
  subdomain: string
  signingOut: boolean
  unread: number
  isDashboard: boolean
  isWorkspace: boolean
  isNotifications: boolean
  isSettings: boolean
  isMembers: boolean
  /** Closes the mobile drawer after a tap. */
  onNavigate: () => void
  onSignOut: () => void
  mobile?: boolean
}

/**
 * Defined at module scope rather than inside PortalShell: a component created
 * during render is a new type on every pass, so React unmounts and remounts the
 * whole subtree — which would drop the drawer's scroll position and restart its
 * transitions on every keystroke elsewhere in the shell.
 */
function Sidebar({
  base, accent, branding, clientName, subdomain, signingOut, unread,
  isDashboard, isWorkspace, isNotifications, isSettings, isMembers, onNavigate, onSignOut, mobile,
}: SidebarProps) {
  return (
    <div
      className={`${mobile ? 'flex flex-col h-full' : 'hidden md:flex flex-col h-screen'} w-60 flex-shrink-0 border-r bg-white`}
      style={{ borderColor: '#EBEBEB' }}
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: '#EBEBEB' }}>
        <BrandMark branding={branding} accent={accent} />
        <div className="min-w-0">
          <p className="text-xs2 font-semibold text-gray-900 truncate leading-tight">{branding.business_name}</p>
          <p className="text-2xs text-gray-400 truncate">Client Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <NavItem href={base}                    icon={LayoutDashboard} label="Dashboard"     active={isDashboard}     accent={accent} onNavigate={onNavigate} />
        <NavItem href={`${base}/workspace`}     icon={Briefcase}       label="Workspace"     active={isWorkspace}     accent={accent} onNavigate={onNavigate} />
        <NavItem href={`${base}/notifications`} icon={Bell}            label="Notifications" active={isNotifications} accent={accent} onNavigate={onNavigate} badge={unread} />
        <NavItem href={`${base}/members`}       icon={Users}           label="Your team"     active={isMembers}       accent={accent} onNavigate={onNavigate} />
        <NavItem href={`${base}/settings`}      icon={Settings}        label="Settings"      active={isSettings}      accent={accent} onNavigate={onNavigate} />
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t" style={{ borderColor: '#EBEBEB' }}>
        <div className="px-2 py-1.5 mb-1">
          <p className="text-2xs text-gray-400">Signed in as</p>
          <p className="text-xs2 font-medium text-gray-700 truncate">{clientName}</p>
        </div>
        <PortalFeedbackButton subdomain={subdomain} accent={accent} />
        <button
          onClick={onSignOut}
          disabled={signingOut}
          className="flex items-center gap-2 w-full px-3 h-11 rounded-xl text-xs2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <LogOut size={14} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}

function NavItem({
  href, icon: Icon, label, active, accent, onNavigate, badge,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
  accent: string
  onNavigate: () => void
  badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition-colors"
      style={{
        backgroundColor: active ? `${accent}15` : 'transparent',
        color: active ? accent : 'rgba(0,0,0,0.45)',
      }}
    >
      <Icon size={17} className="flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {!!badge && badge > 0 && (
        <span
          className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center"
          style={{ backgroundColor: accent }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}

/**
 * The workspace's logo, falling back to its initial.
 *
 * `logo_url` comes from the owner's `fey_settings.logo` — which is a DIFFERENT
 * field from their personal avatar. An owner who only filled in the avatar gets
 * the initial here, which is correct: a personal photo is not a brand mark.
 */
function BrandMark({ branding, accent }: { branding: PortalOwnerBranding; accent: string }) {
  if (branding.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded data URL / remote logo
      <img
        src={branding.logo_url}
        alt={branding.business_name}
        className="h-9 w-9 rounded-xl object-cover flex-shrink-0 border border-gray-100"
      />
    )
  }
  return (
    <div
      className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
      style={{ backgroundColor: accent }}
    >
      {branding.business_name.charAt(0).toUpperCase()}
    </div>
  )
}
