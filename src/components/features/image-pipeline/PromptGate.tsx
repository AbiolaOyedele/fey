'use client'

import { useState } from 'react'
import { Check, RefreshCw, ArrowLeft } from 'lucide-react'
import { CREDIT_COST } from '@/types/image-pipeline'
import type { IpGeneration } from '@/types/image-pipeline'

interface PromptGateProps {
  generation: IpGeneration
  busy: boolean
  onConfirm: (prompt: string) => void
  /** Return to the input form to change the references or the brief. */
  onBack: () => void
  accent: string
}

/**
 * Gate 1 — prompt review. The generated prompt is shown and fully editable;
 * confirming renders the first preview (already paid for by the start charge,
 * so no extra charge here). Skipped for users with skip_prompt_review on.
 *
 * Editing the text here covers wording changes, but not "I picked the wrong
 * reference" — hence the back action, which returns to the form with the images
 * and brief still populated. It abandons this run rather than resuming it, so
 * the cost is stated on the button rather than buried.
 */
export default function PromptGate({ generation, busy, onConfirm, onBack, accent }: PromptGateProps) {
  const [prompt, setPrompt] = useState(generation.generated_prompt ?? '')
  const edited = prompt.trim() !== (generation.generated_prompt ?? '').trim()

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-display text-sm text-gray-800">Review the prompt</h3>
        <span className="text-3xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: accent, backgroundColor: `${accent}1F` }}>Gate 1</span>
      </div>
      <p className="text-2xs text-gray-400 mb-3">
        This is what will be sent to the image model. Edit it if you like — the first preview is already included, so tweaking here costs nothing extra.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={5}
        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 outline-none resize-y focus:border-gray-300"
        style={{ ['--tw-ring-color' as string]: accent }}
      />
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => onConfirm(prompt.trim())}
          disabled={busy || !prompt.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 h-12 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {edited ? <RefreshCw size={15} /> : <Check size={15} />}
          {edited ? 'Use edited prompt' : 'Generate preview'}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 h-12 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <ArrowLeft size={15} /> Change images or brief
        </button>
      </div>
      <p className="text-2xs text-gray-400 mt-2 mb-0">
        Generating renders a 1K preview for approval. Going back keeps your references and brief,
        but abandons this prompt — starting again costs another {CREDIT_COST.preview} credit.
      </p>
    </div>
  )
}
