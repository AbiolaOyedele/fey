'use client'

import { use } from 'react'
import Link from 'next/link'
import { MessageSquare, Sparkles, FileText, CheckSquare2, ArrowRight, Briefcase } from 'lucide-react'
import { usePortalBase } from '@/hooks/usePortalBase'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { Stagger, StaggerItem, FadeIn } from '@/components/ui/motion'

/**
 * Workspace — the client's hub, built to read like the owner's Playground: one
 * card per corner, a single accent rather than a rainbow of per-section colours,
 * and the same card/typography scale as the rest of the app.
 */

interface Section {
  label: string
  description: string
  icon: React.ElementType
  /** Portal-relative path; the base is applied at render time. */
  path: string
}

const SECTIONS: Section[] = [
  { label: 'Tasks',     description: 'What’s in progress and what’s done.',     icon: CheckSquare2,  path: '/tasks' },
  { label: 'Messages',  description: 'Chat directly with the team.',            icon: MessageSquare, path: '/messages' },
  { label: 'Brands',    description: 'Each brand’s own chat and files.',        icon: Sparkles,      path: '/projects' },
  { label: 'Documents', description: 'Files, contracts, forms and billing.',    icon: FileText,      path: '/documents' },
]

export default function WorkspacePage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const base   = usePortalBase(subdomain)
  const accent = usePortalAccent(subdomain)

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Briefcase size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Workspace</h1>
        </div>
        <p className="text-xs text-gray-400 mb-6">Everything we’re working on together, in one place.</p>
      </FadeIn>

      <Stagger className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-4xl">
        {SECTIONS.map(({ label, description, icon: Icon, path }) => (
          <StaggerItem key={path} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={`${base}${path}`}
              className="group relative block h-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden hover:shadow-md transition-shadow duration-200"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
                style={{ backgroundColor: `${accent}15`, color: accent }}
              >
                <Icon size={20} />
              </div>
              <h2 className="text-sm font-semibold text-gray-800 mb-1">{label}</h2>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">{description}</p>
              <span
                className="inline-flex items-center gap-1 text-xs font-medium transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ color: accent }}
              >
                Open <ArrowRight size={13} />
              </span>
              <Icon
                size={96}
                className="absolute -bottom-5 -right-5 text-gray-50 group-hover:text-gray-100 transition-colors pointer-events-none"
              />
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  )
}
