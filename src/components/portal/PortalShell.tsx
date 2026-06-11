'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  MessageSquare, Folder, FileSignature, ClipboardList,
  CreditCard, FileText, CheckSquare2, Home, Menu, X, LogOut,
} from 'lucide-react'
import { portalTokenKey } from '@/app/portal/[subdomain]/layout'
import type { PortalOwnerBranding } from '@/types/crm'

interface PortalShellProps {
  subdomain: string
  branding: PortalOwnerBranding
  clientName: string
  children: React.ReactNode
}

const NAV_ITEMS = [
  { href: '',          icon: Home,          label: 'Home' },
  { href: '/messages', icon: MessageSquare, label: 'Messages' },
  { href: '/files',    icon: Folder,        label: 'Files' },
  { href: '/contracts',icon: FileSignature, label: 'Contracts' },
  { href: '/forms',    icon: ClipboardList, label: 'Forms' },
  { href: '/payments', icon: CreditCard,    label: 'Payments' },
  { href: '/invoices', icon: FileText,      label: 'Invoices' },
  { href: '/tasks',    icon: CheckSquare2,  label: 'Tasks' },
]

export default function PortalShell({ subdomain, branding, clientName, children }: PortalShellProps) {
  const pathname   = usePathname()
  const router     = useRouter()
  const [open,     setOpen]     = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const base = `/portal/${subdomain}`

  const isActive = (href: string) => {
    const full = `${base}${href}`
    return href === '' ? pathname === base || pathname === `${base}/` : pathname.startsWith(full)
  }

  const signOut = () => {
    setSigningOut(true)
    localStorage.removeItem(portalTokenKey(subdomain))
    router.push(`${base}/login`)
  }

  const Sidebar = ({ mobile }: { mobile?: boolean }) => (
    <div className={`${mobile ? 'flex flex-col h-full' : 'hidden md:flex flex-col h-screen'} w-64 bg-[#101010] text-white flex-shrink-0`}>
      {/* Logo / brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        {branding.logo_url ? (
          <img src={branding.logo_url} alt={branding.business_name} className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: branding.accent_color || '#ED64A6' }}
          >
            {branding.business_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{branding.business_name}</p>
          <p className="text-xs text-white/50 truncate">Client Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = isActive(href)
            return (
              <Link
                key={label}
                href={`${base}${href}`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-white/40">Logged in as</p>
          <p className="text-sm text-white/80 font-medium truncate">{clientName}</p>
        </div>
        <button
          onClick={() => void signOut()}
          disabled={signingOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={15} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-64">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setOpen(true)} className="text-gray-600">
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-800">{branding.business_name}</span>
          {open && (
            <button onClick={() => setOpen(false)} className="ml-auto text-gray-600">
              <X size={20} />
            </button>
          )}
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
