'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  MessageSquare, Folder, FileSignature,
  ClipboardList, CreditCard, FileText, CheckSquare2, ArrowRight,
} from 'lucide-react'
import { usePortalBase } from '@/hooks/usePortalBase'

interface Section {
  label: string
  description: string
  icon: React.ElementType
  color: string
  href: string
}

export default function WorkspacePage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const base = usePortalBase(subdomain)

  const sections: Section[] = [
    {
      label:       'Messages',
      description: 'Chat with your team',
      icon:        MessageSquare,
      color:       '#6366F1',
      href:        `${base}/messages`,
    },
    {
      label:       'Files',
      description: 'Shared documents and assets',
      icon:        Folder,
      color:       '#F59E0B',
      href:        `${base}/files`,
    },
    {
      label:       'Contracts',
      description: 'Sign and review agreements',
      icon:        FileSignature,
      color:       '#10B981',
      href:        `${base}/contracts`,
    },
    {
      label:       'Forms',
      description: 'Requests and questionnaires',
      icon:        ClipboardList,
      color:       '#EC4899',
      href:        `${base}/forms`,
    },
    {
      label:       'Invoices',
      description: 'Billing and payment history',
      icon:        FileText,
      color:       '#8B5CF6',
      href:        `${base}/invoices`,
    },
    {
      label:       'Payments',
      description: 'Pending payment requests',
      icon:        CreditCard,
      color:       '#06B6D4',
      href:        `${base}/payments`,
    },
    {
      label:       'Tasks',
      description: 'Your project deliverables',
      icon:        CheckSquare2,
      color:       '#84CC16',
      href:        `${base}/tasks`,
    },
  ]

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Workspace</h1>
        <p className="text-sm text-gray-500 mt-1">Everything related to your project, in one place.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sections.map(({ label, description, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href}
            className="group flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:border-gray-200 hover:shadow-sm transition-all"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}18` }}
            >
              <Icon size={18} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-gray-900">{label}</p>
              <p className="text-[12px] text-gray-400 truncate">{description}</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
