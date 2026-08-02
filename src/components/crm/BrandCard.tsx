'use client'

import { Sparkles, ArrowRight } from 'lucide-react'
import { formatDate } from '@/utils/formatDate'
import type { Project, ProjectStatus } from '@/types/project'

/**
 * One brand, as a card.
 *
 * Matches the Documents hub card exactly — accent icon tile, title, muted
 * description, an "Open" affordance and a ghosted watermark. The brands grid
 * used to have its own look (coloured status pills, a tighter card, a different
 * hover), so the two tabs sitting next to each other read as two different
 * products. Shared by the owner's CRM and the client portal.
 */

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active:    'Active',
  on_hold:   'On hold',
  completed: 'Completed',
  archived:  'Archived',
}

interface BrandCardProps {
  project: Project
  accent: string
  onOpen: () => void
}

export default function BrandCard({ project: p, accent, onOpen }: BrandCardProps) {
  // Only a live brand earns the accent; the rest stay grey so the grid doesn't
  // turn into a colour chart.
  const live = p.status === 'active'
  const meta = p.due_date ? `Due ${formatDate(p.due_date)}` : `Created ${formatDate(p.created_at)}`

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full h-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Sparkles size={20} />
        </div>
        <span
          className="flex-shrink-0 text-2xs font-semibold uppercase tracking-widest"
          style={{ color: live ? accent : '#CBD5E1' }}
        >
          {STATUS_LABEL[p.status]}
        </span>
      </div>

      <h2 className="text-sm font-semibold text-gray-800 mb-1 truncate">{p.title}</h2>
      <p className="text-xs text-gray-400 leading-relaxed mb-4 line-clamp-2 min-h-[2rem]">
        {p.description ?? meta}
      </p>

      <span className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 text-xs font-medium transition-transform duration-200 group-hover:translate-x-0.5"
          style={{ color: accent }}
        >
          Open <ArrowRight size={13} />
        </span>
        {p.description && <span className="text-2xs text-gray-300 truncate">{meta}</span>}
      </span>

      <Sparkles
        size={96}
        className="absolute -bottom-5 -right-5 text-gray-50 group-hover:text-gray-100 transition-colors pointer-events-none"
      />
    </button>
  )
}
