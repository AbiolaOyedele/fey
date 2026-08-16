'use client'

import { useState } from 'react'
import { Check, X, RefreshCw, Pencil, Maximize2 } from 'lucide-react'
import type { IpGeneration } from '@/types/image-pipeline'
import { CREDIT_COST, runFinalSizeLabel } from '@/types/image-pipeline'
import StatusPill from './StatusPill'
import ImageLightbox from './ImageLightbox'
import { assetFilename } from './download'
import { fmtCredits } from './format'

interface PreviewStageProps {
  generation: IpGeneration
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onEdit: (prompt: string) => void
  accent: string
}

/**
 * Gate 2 — image approval (never skippable). Shows the 1K preview with Approve
 * (renders the 2K final, 0.75), Reject (0.25 already spent, no refund) and an
 * optional prompt edit that regenerates the preview for another 0.25.
 */
export default function PreviewStage({ generation, busy, onApprove, onReject, onEdit, accent }: PreviewStageProps) {
  const rendering = generation.status === 'generating_final' || generation.status === 'generating_preview'
  // Not every engine renders the final at 2K — say what this run will produce.
  const finalSize = runFinalSizeLabel(generation)
  const promptText = generation.final_prompt ?? generation.generated_prompt ?? ''
  const [lightbox, setLightbox] = useState(false)
  const [editing, setEditing] = useState(false)
  const [prompt, setPrompt] = useState(promptText)
  // Re-sync the editable field when a regeneration swaps in a new prompt
  // (React's "adjust state during render" pattern — no effect needed).
  const [lastPrompt, setLastPrompt] = useState(promptText)
  if (promptText !== lastPrompt) {
    setLastPrompt(promptText)
    setPrompt(promptText)
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm text-gray-800">Approve the preview</h3>
          <span className="text-3xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: accent, backgroundColor: `${accent}1F` }}>Gate 2</span>
        </div>
        <StatusPill status={generation.status} accent={accent} />
      </div>

      {/* Preview image — tap to enlarge / download */}
      <div className="relative rounded-xl overflow-hidden bg-gray-50 aspect-square max-w-sm mx-auto">
        {generation.preview_url && !rendering ? (
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="group block w-full h-full cursor-zoom-in"
            aria-label="View preview larger"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary/mock preview asset */}
            <img src={generation.preview_url} alt="1K preview" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
            <span className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 size={14} />
            </span>
          </button>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
            <RefreshCw size={22} className="animate-spin" style={{ color: accent }} />
            <span className="text-2xs">{generation.status === 'generating_final' ? `Rendering ${finalSize} final…` : 'Rendering preview…'}</span>
          </div>
        )}
        <span className="absolute top-2 left-2 text-3xs font-semibold uppercase tracking-wide text-white bg-black/50 px-1.5 py-0.5 rounded pointer-events-none">1K preview</span>
      </div>

      {lightbox && generation.preview_url && (
        <ImageLightbox
          url={generation.preview_url}
          filename={assetFilename(generation.id, 'preview')}
          caption={promptText}
          accent={accent}
          onClose={() => setLightbox(false)}
        />
      )}

      {/* Prompt (editable → regenerate) */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1.5 text-2xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          <Pencil size={12} /> {editing ? 'Hide prompt' : 'Edit prompt'}
        </button>
        {editing && (
          <div className="mt-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 outline-none resize-y focus:border-gray-300"
            />
            <button
              type="button"
              onClick={() => onEdit(prompt.trim())}
              disabled={busy || !prompt.trim() || rendering}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 h-11 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw size={13} /> Regenerate preview · {fmtCredits(CREDIT_COST.preview)} credits
            </button>
          </div>
        )}
      </div>

      {/* Approve / Reject */}
      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <button
          type="button"
          onClick={onApprove}
          disabled={busy || rendering}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 h-12 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          <Check size={16} /> Approve · render {finalSize} ({fmtCredits(CREDIT_COST.final)})
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={busy || rendering}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 h-12 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <X size={16} /> Reject
        </button>
      </div>
    </div>
  )
}
