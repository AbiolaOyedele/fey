'use client'

import Link from 'next/link'
import { Settings, ArrowRight, UserPlus } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useCrmPending } from '@/hooks/useCrmPending'
import { resolveWorkspaceName } from '@/utils/workspace'
import { useGreeting } from '@/hooks/useGreeting'

export default function DashboardPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const pending = useCrmPending(user?.id)

  const workspaceName = resolveWorkspaceName(settings.company_name, settings.workspace_slug)
  const greeting = useGreeting(workspaceName)
  const rawHeading = (settings.dashboard_heading ?? '').replace(/\\n/g, '\n')
  const isCustomHeading = !!rawHeading.trim() && rawHeading !== 'Track your\nwork & earnings'
  const heading = isCustomHeading ? rawHeading : greeting

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 page-enter">
      {/* Hero heading */}
      <div className="flex items-start justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1
            className="font-display text-[20px] leading-snug font-normal text-gray-700"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {heading}
          </h1>
          {settings.dashboard_subtitle && (
            <p className="text-gray-500 text-sm mt-2">{settings.dashboard_subtitle}</p>
          )}
        </div>
        <Link
          href="/settings"
          className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors flex-shrink-0"
        >
          <Settings size={16} />
        </Link>
      </div>

      {/* Getting started — shown to a brand-new workspace (no CRM clients yet) */}
      {pending.loaded && pending.contactCount === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Welcome to your workspace 👋</h2>
          <p className="text-sm text-gray-500 mt-1.5 mb-5 max-w-lg leading-relaxed">
            This is your home base. Add your first client to start sending them messages,
            files, contracts, forms and invoices through their portal — or set up your
            workspace branding first.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/clients?new=1"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              <UserPlus size={15} /> Add your first client
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Settings size={15} /> Set up workspace
            </Link>
          </div>
        </div>
      )}

      {/* Needs attention — pending CRM items across all clients */}
      {(pending.unreadMessages + pending.pendingContracts + pending.pendingForms) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800">Needs your attention</p>
            <Link href="/clients" className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
              Review <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { count: pending.unreadMessages,   label: 'Unread messages' },
              { count: pending.pendingContracts, label: 'Pending contracts' },
              { count: pending.pendingForms,     label: 'Pending forms' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-gray-50 px-3 py-2.5">
                <p className="text-xl font-bold text-gray-900">{s.count}</p>
                <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
