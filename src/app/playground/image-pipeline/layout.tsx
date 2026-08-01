'use client'

import Link from 'next/link'
import { ArrowLeft, Lock, Sparkles } from 'lucide-react'
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
 *
 * The whole corner is currently restricted to the platform super admin. This
 * layout renders a locked state instead of the children when the server refuses
 * the module — every route underneath is gated server-side too, so this is the
 * polite front door, not the lock itself.
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
  const { context, loading, forbidden } = useImagePipelineContext()
  const showAdmin = !!context && (context.admin.is_super_admin || context.admin.is_workspace_owner)

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 page-enter">
        <div className="h-5 w-40 rounded-lg bg-gray-100 animate-pulse" />
        <div className="mt-3 h-3 w-64 rounded-lg bg-gray-50 animate-pulse" />
      </div>
    )
  }

  if (forbidden) return <Locked />

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

function Locked() {
  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="max-w-md mx-auto mt-8 rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 text-center">
          <div className="w-11 h-11 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-4">
            <Lock size={18} />
          </div>
          <h1 className="font-display text-lg font-normal text-gray-800 mb-1">Image Pipeline is closed</h1>
          <p className="text-xs text-gray-400 leading-relaxed mb-5">
            This corner is still being built and is limited to the platform super admin for now. It’ll open up once it’s ready.
          </p>
          <Link
            href="/playground"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 h-11 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors active:scale-[0.98]"
          >
            <ArrowLeft size={15} /> Back to Playground
          </Link>
        </div>
      </FadeIn>
    </div>
  )
}
