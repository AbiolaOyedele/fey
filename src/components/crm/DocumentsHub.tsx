'use client'

import Link from 'next/link'
import { Folder, FileSignature, ClipboardList, CreditCard, FileText, ArrowRight } from 'lucide-react'

/**
 * The Documents hub — one tab covering what used to be five.
 *
 * Files, Contracts, Forms, Payments and Invoices are all "paperwork for this
 * client", and five separate tabs pushed the tab bar into horizontal scrolling
 * on every phone. They're now cards behind a single Documents tab; each still
 * opens its own page, so nothing about those sections changed except how you
 * reach them.
 *
 * Shared by the owner's CRM and the client portal so both stay in step — only
 * the link base and the counts differ.
 */

export interface DocumentSection {
  key: 'files' | 'contracts' | 'forms' | 'payments' | 'invoices'
  label: string
  description: string
  /** Live count, when the caller has one. `undefined` renders no badge. */
  count?: number | undefined
  /** Wording for the count, e.g. "3 awaiting signature". */
  countLabel?: string | undefined
}

const ICONS: Record<DocumentSection['key'], React.ElementType> = {
  files:     Folder,
  contracts: FileSignature,
  forms:     ClipboardList,
  payments:  CreditCard,
  invoices:  FileText,
}

interface DocumentsHubProps {
  /** Link prefix — `/clients/<id>` in the app, the portal base in the portal. */
  base: string
  accent: string
  sections: DocumentSection[]
  loading?: boolean
}

export default function DocumentsHub({ base, accent, sections, loading }: DocumentsHubProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-4xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-4xl">
      {sections.map(({ key, label, description, count, countLabel }) => {
        const Icon = ICONS[key]
        const hasCount = typeof count === 'number' && count > 0
        return (
          <Link
            key={key}
            href={`${base}/${key}`}
            className="group relative block h-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
                style={{ backgroundColor: `${accent}15`, color: accent }}
              >
                <Icon size={20} />
              </div>
              {hasCount && (
                <span
                  className="min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-semibold text-white flex items-center justify-center tabular-nums"
                  style={{ backgroundColor: accent }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>

            <h2 className="text-sm font-semibold text-gray-800 mb-1">{label}</h2>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              {hasCount && countLabel ? countLabel : description}
            </p>

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
        )
      })}
    </div>
  )
}
