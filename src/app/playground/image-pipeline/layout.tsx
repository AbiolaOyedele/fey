'use client'

import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { FadeIn } from '@/components/ui/motion'
import { PipelineProvider, useImagePipelineContext } from '@/hooks/useImagePipelineContext'
import PipelineNav from '@/components/features/image-pipeline/PipelineNav'
import CreditBadge from '@/components/features/image-pipeline/CreditBadge'

/**
 * Shared chrome for the Image Pipeline corner: header, live balance chip and the
 * section tabs. Wrapped in PipelineProvider so the header and every page share
 * one context instance (balance updates everywhere on a charge). The Admin tab
 * shows only for a super admin or the workspace owner.
 */
export default function ImagePipelineLayout({ children }: { children: React.ReactNode }) {
  return (
    <PipelineProvider>
      <Chrome>{children}</Chrome>
    </PipelineProvider>
  )
}

function Chrome({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const { context } = useImagePipelineContext()
  const showAdmin = !!context && (context.admin.is_super_admin || context.admin.is_workspace_owner)

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/playground" title="Back to Playground" className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0">
              <ArrowLeft size={16} />
            </Link>
            <Sparkles size={18} style={{ color: accent }} className="flex-shrink-0" />
            <h1 className="font-display text-xl font-normal text-gray-800 truncate">Image Pipeline</h1>
          </div>
          {context && <CreditBadge balance={context.balance} accent={accent} />}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Upload a reference or write a prompt, let Claude refine it, generate with Nano Banana — preview first, approve to finalize.
        </p>
        <PipelineNav showAdmin={showAdmin} accent={accent} />
      </FadeIn>

      <div className="mt-6 max-w-5xl">{children}</div>
    </div>
  )
}
