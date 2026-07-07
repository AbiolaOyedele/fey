'use client'

import Link from 'next/link'
import { Briefcase, Users, FolderKanban, CreditCard, FileText, ArrowRight } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { Stagger, StaggerItem, FadeIn } from '@/components/ui/motion'

/**
 * CRM — one home for everything client-facing. The pages keep their existing
 * routes; this hub just gathers them so the sidebar stays lean.
 */
export default function CrmHubPage() {
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const appMode = settings.app_mode || 'dual'
  const clientsLabel = settings.clients_label || 'Clients'

  const sections = [
    ...(appMode !== 'tasks' ? [{
      href: '/clients',
      label: clientsLabel,
      description: 'Client workspaces, tasks and retainers',
      icon: <Users size={20} />,
    }] : []),
    {
      href: '/projects',
      label: 'Projects',
      description: 'Boards, briefs and deliverables',
      icon: <FolderKanban size={20} />,
    },
    {
      href: '/payments',
      label: 'Payments',
      description: 'Money in, retainers and payment requests',
      icon: <CreditCard size={20} />,
    },
    {
      href: '/invoices',
      label: 'Invoices',
      description: 'Create, send and track invoices',
      icon: <FileText size={20} />,
    },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Briefcase size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">CRM</h1>
        </div>
        <p className="text-xs text-gray-400 mb-6">Everything client-facing, in one place.</p>
      </FadeIn>

      <Stagger className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 max-w-4xl">
        {sections.map((s) => (
          <StaggerItem key={s.href} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={s.href}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 hover:shadow-md transition-shadow duration-200 flex flex-col h-full min-h-[136px]"
            >
              <div
                className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
                style={{ backgroundColor: `${accent}15`, color: accent }}
              >
                {s.icon}
              </div>
              <h2 className="text-sm font-semibold text-gray-800 mb-0.5">{s.label}</h2>
              <p className="text-xs text-gray-400 leading-relaxed flex-1">{s.description}</p>
              <span
                className="inline-flex items-center gap-1 text-xs font-medium mt-2 transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ color: accent }}
              >
                Open <ArrowRight size={12} />
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  )
}
