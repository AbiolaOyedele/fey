'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Briefcase, Menu, X, LogOut } from 'lucide-react'
import { portalTokenKey } from '@/app/portal/[subdomain]/layout'
import PortalWorkspaceTabs, { PORTAL_SECTIONS } from './PortalWorkspaceTabs'
import type { PortalOwnerBranding } from '@/types/crm'

interface PortalShellProps {
  subdomain:  string
  branding:   PortalOwnerBranding
  clientName: string
  children:   React.ReactNode
}

// Workspace sub-routes — all count as "Workspace" in the sidebar
const WORKSPACE_ROUTES = ['/messages', '/files', '/contracts', '/forms', '/invoices', '/tasks', '/payments', '/workspace']

export default function PortalShell({ subdomain, branding, clientName, children }: PortalShellProps) {
  const pathname = usePathname() ?? ''
  const router   = useRouter()
  const [open, setOpen]           = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const base   = `/portal/${subdomain}`
  const accent = branding.accent_color || '#ED64A6'

  const isDashboard = pathname === base || pathname === `${base}/`
  const isWorkspace = WORKSPACE_ROUTES.some((r) => pathname.startsWith(`${base}${r}`))

  // Show the section tab bar when the client is inside one of the workspace
  // sections (not on the dashboard or the workspace hub).
  const showTabs = PORTAL_SECTIONS.some((s) => pathname.startsWith(`${base}${s.path}`))

  const signOut = () => {
    setSigningOut(true)
    localStorage.removeItem(portalTokenKey(subdomain))
    router.push(`${base}/login`)
  }

  const NavItem = ({
    href, icon: Icon, label, active,
  }: { href: string; icon: React.ElementType; label: string; active: boolean }) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={{
        backgroundColor: active ? `${accent}18` : 'transparent',
        color: active ? accent : 'rgba(0,0,0,0.45)',
      }}
    >
      <Icon size={17} className="flex-shrink-0" />
      {label}
    </Link>
  )

  const Sidebar = ({ mobile }: { mobile?: boolean }) => (
    <div
      className={`${mobile ? 'flex flex-col h-full' : 'hidden md:flex flex-col h-screen'} w-60 flex-shrink-0 border-r`}
      style={{ backgroundColor: '#FAFAFA', borderColor: '#EBEBEB' }}
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: '#EBEBEB' }}>
        {branding.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logo_url}
            alt={branding.business_name}
            className="h-8 w-8 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: accent }}
          >
            {branding.business_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
            {branding.business_name}
          </p>
          <p className="text-[11px] text-gray-400 truncate">Client Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <NavItem href={base}                    icon={LayoutDashboard} label="Dashboard" active={isDashboard} />
        <NavItem href={`${base}/workspace`}     icon={Briefcase}       label="Workspace"  active={isWorkspace} />
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t" style={{ borderColor: '#EBEBEB' }}>
        <div className="px-2 py-1.5 mb-1">
          <p className="text-[11px] text-gray-400">Signed in as</p>
          <p className="text-[13px] font-medium text-gray-700 truncate">{clientName}</p>
        </div>
        <button
          onClick={() => void signOut()}
          disabled={signingOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[13px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <LogOut size={14} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-60">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#EBEBEB' }}>
          <button onClick={() => setOpen(true)} className="text-gray-500">
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-800">{branding.business_name}</span>
          {open && (
            <button onClick={() => setOpen(false)} className="ml-auto text-gray-500">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Section tabs — the client's equivalent of the owner's ContactTabs */}
        {showTabs && <PortalWorkspaceTabs subdomain={subdomain} accent={accent} />}

        <main className="flex-1 overflow-y-auto bg-[#F5F5F7]">
          {children}
        </main>
      </div>
    </div>
  )
}
