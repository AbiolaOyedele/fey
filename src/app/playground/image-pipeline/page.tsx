'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Sparkles, RefreshCw, Download, RotateCcw, AlertCircle, Maximize2, Clock } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { CREDIT_COST, RETENTION_WEEK_OPTIONS, DEFAULT_RETENTION_WEEKS } from '@/types/image-pipeline'
import type { GenerationChannel, GenerationStatus, RetentionWeeks } from '@/types/image-pipeline'
import { useImagePipeline } from '@/hooks/useImagePipeline'
import { useImagePipelineContext } from '@/hooks/useImagePipelineContext'
import ReferenceUploader, { type ReferenceAsset } from '@/components/features/image-pipeline/ReferenceUploader'
import ChannelSelector from '@/components/features/image-pipeline/ChannelSelector'
import PromptGate from '@/components/features/image-pipeline/PromptGate'
import PreviewStage from '@/components/features/image-pipeline/PreviewStage'
import StatusPill from '@/components/features/image-pipeline/StatusPill'
import ImageLightbox from '@/components/features/image-pipeline/ImageLightbox'
import { assetFilename, downloadImage } from '@/components/features/image-pipeline/download'
import { creditsLabel, fmtCredits } from '@/components/features/image-pipeline/format'

/**
 * Generate — the core pipeline UI. A run needs a reference image OR a prompt (or
 * both); Claude refines the prompt, then it goes through the preview/approve
 * gates to a 2K final. Every action and status change surfaces a toast.
 */
export default function ImagePipelineGeneratePage() {
  const { settings, showToast } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const { context, channels, refresh, updateRetention } = useImagePipelineContext()
  const { generation, busy, error, start, confirm, edit, approve, reject, reset } = useImagePipeline(refresh)

  const [asset, setAsset] = useState<ReferenceAsset | null>(null)
  const [prompt, setPrompt] = useState('')
  const [channel, setChannel] = useState<GenerationChannel>('api')
  const [retention, setRetention] = useState<RetentionWeeks>(DEFAULT_RETENTION_WEEKS)
  const [retentionSynced, setRetentionSynced] = useState(false)
  const [finalLightbox, setFinalLightbox] = useState(false)
  const [finalBusy, setFinalBusy] = useState(false)

  // Sync the retention control to the user's saved preference once, on load.
  if (context && !retentionSynced) {
    setRetentionSynced(true)
    setRetention(context.retention_weeks)
  }

  // Toast on async status transitions (stands in for Realtime notifications).
  const prevStatus = useRef<GenerationStatus | null>(null)
  useEffect(() => {
    const s = generation?.status
    if (!s || s === prevStatus.current) return
    if (s === 'preview_ready') showToast('Preview ready to review')
    else if (s === 'complete') showToast('Your 2K image is ready')
    else if (s === 'failed') showToast('That generation failed. Please try again.')
    prevStatus.current = s
  }, [generation?.status, showToast])

  const balance = context?.balance ?? 0
  const canAfford = balance >= CREDIT_COST.preview
  const status = generation?.status
  const hasInput = !!asset || prompt.trim().length > 0

  const startNew = () => { reset(); setAsset(null); setPrompt(''); prevStatus.current = null }

  const chooseRetention = (weeks: RetentionWeeks) => {
    setRetention(weeks)
    void updateRetention(weeks)
    showToast(`Images will be kept for ${weeks === 1 ? '1 week' : '2 weeks'}`)
  }

  const beginGeneration = async () => {
    if (!hasInput) return
    const args = {
      channel,
      retention_weeks: retention,
      ...(asset ? { source_image_public_id: asset.public_id, source_image_url: asset.url } : {}),
      ...(prompt.trim() ? { user_prompt: prompt.trim() } : {}),
    }
    const r = await start(args)
    showToast(r.ok ? 'Generation started — writing your prompt…' : r.message ?? 'Couldn’t start the generation.')
  }

  const doConfirm = async (p: string) => {
    const r = await confirm(p)
    if (!r.ok) showToast(r.message ?? 'Couldn’t generate the preview.')
  }
  const doEdit = async (p: string) => {
    const r = await edit(p)
    showToast(r.ok ? 'Regenerating your preview…' : r.message ?? 'Couldn’t regenerate.')
  }
  const doApprove = async () => {
    const r = await approve()
    if (!r.ok) showToast(r.message ?? 'Couldn’t approve.')
  }
  const doReject = async () => {
    const r = await reject()
    showToast(r.ok ? 'Preview rejected — it stays in your gallery until it expires.' : r.message ?? 'Couldn’t reject.')
  }

  const downloadFinal = async () => {
    if (!generation?.final_url) return
    setFinalBusy(true)
    try {
      await downloadImage(generation.final_url, assetFilename(generation.id, 'final'))
      showToast('Image downloaded')
    } catch {
      showToast('Couldn’t download the image. Please try again.')
    } finally {
      setFinalBusy(false)
    }
  }

  /* ── Idle: the input + configure form ── */
  if (!generation) {
    return (
      <div className="space-y-5">
        <div>
          <label className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Reference image (optional)</label>
          <ReferenceUploader asset={asset} onSelect={setAsset} accent={accent} />
        </div>

        <div>
          <label className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Your prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder={asset ? 'Add direction for the reference — mood, style, framing… (optional)' : 'Describe what you want to generate…'}
            className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 outline-none resize-y focus:border-gray-300"
          />
          <p className="text-2xs text-gray-400 mt-1.5">Claude refines your prompt before generating. A reference image is optional — a prompt alone works.</p>
        </div>

        <RetentionChooser value={retention} onChange={chooseRetention} accent={accent} />

        <ChannelSelector channels={channels} value={channel} onChange={setChannel} accent={accent} />

        {error && <InlineError message={error} />}
        {!canAfford && <InlineError message="You don’t have enough credits to start. Request more from the Credits page." />}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={beginGeneration}
            disabled={!hasInput || busy || !canAfford}
            className="inline-flex items-center gap-2 rounded-xl px-5 h-12 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            <Sparkles size={16} /> {busy ? 'Starting…' : `Generate · ${fmtCredits(CREDIT_COST.preview)} credits`}
          </button>
          {context && (
            <span className="text-2xs text-gray-400">
              Tier <span className="font-semibold text-gray-600 uppercase">{context.tier.tier}</span> · a full run costs {creditsLabel(CREDIT_COST.preview + CREDIT_COST.final)}
            </span>
          )}
        </div>
      </div>
    )
  }

  /* ── Active generation states ── */
  return (
    <div className="space-y-5">
      {(status === 'prompting' || status === 'generating_preview') && (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 flex flex-col items-center text-center">
          <RefreshCw size={26} className="animate-spin mb-3" style={{ color: accent }} />
          <StatusPill status={status} accent={accent} />
          <p className="text-xs text-gray-400 mt-3">
            {status === 'prompting' ? 'Claude is refining the prompt…' : 'Rendering your 1K preview…'}
          </p>
        </div>
      )}

      {status === 'prompt_review' && (
        <PromptGate generation={generation} busy={busy} onConfirm={doConfirm} accent={accent} />
      )}

      {(status === 'preview_ready' || status === 'generating_final') && (
        <PreviewStage generation={generation} busy={busy} onApprove={doApprove} onReject={doReject} onEdit={doEdit} accent={accent} />
      )}

      {status === 'complete' && generation.final_url && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-display text-sm text-gray-800">Final image</h3>
            <StatusPill status="complete" accent={accent} />
          </div>
          <button
            type="button"
            onClick={() => setFinalLightbox(true)}
            className="group relative block rounded-xl overflow-hidden bg-gray-50 max-w-md mx-auto cursor-zoom-in w-full"
            aria-label="View final larger"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary/mock final asset */}
            <img src={generation.final_url} alt="Final 2K image" className="w-full h-auto" />
            <span className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 size={14} />
            </span>
          </button>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button
              type="button"
              onClick={downloadFinal}
              disabled={finalBusy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 h-12 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              <Download size={16} /> {finalBusy ? 'Saving…' : 'Download 2K'}
            </button>
            <Link
              href="/playground/image-pipeline/gallery"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 h-12 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98]"
            >
              View gallery
            </Link>
            <button
              type="button"
              onClick={startNew}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 h-12 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98]"
            >
              <RotateCcw size={15} /> New
            </button>
          </div>

          {finalLightbox && (
            <ImageLightbox
              url={generation.final_url}
              filename={assetFilename(generation.id, 'final')}
              caption={generation.final_prompt ?? undefined}
              accent={accent}
              onClose={() => setFinalLightbox(false)}
            />
          )}
        </div>
      )}

      {(status === 'rejected' || status === 'failed') && (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 flex flex-col items-center text-center">
          <StatusPill status={status} accent={accent} />
          <p className="text-sm text-gray-500 mt-3">
            {status === 'rejected'
              ? 'Preview rejected. It stays in your gallery and auto-deletes when it expires.'
              : (generation.error_message ?? 'That generation failed. You can start a new one.')}
          </p>
          <button
            type="button"
            onClick={startNew}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 h-12 text-sm font-medium text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: accent }}
          >
            <RotateCcw size={15} /> Start a new generation
          </button>
        </div>
      )}

      {error && <InlineError message={error} />}
    </div>
  )
}

function RetentionChooser({ value, onChange, accent }: { value: RetentionWeeks; onChange: (w: RetentionWeeks) => void; accent: string }) {
  return (
    <div>
      <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Auto-delete images after</span>
      <div className="inline-flex rounded-xl border border-gray-100 bg-gray-50 p-0.5">
        {RETENTION_WEEK_OPTIONS.map((w) => {
          const active = value === w
          return (
            <button
              key={w}
              type="button"
              onClick={() => onChange(w)}
              className={`inline-flex items-center gap-1.5 px-3.5 h-10 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
              style={active ? { color: accent } : undefined}
            >
              <Clock size={13} /> {w === 1 ? '1 week' : '2 weeks'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: '#FDECEC', color: '#E53E3E' }}>
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
      <p className="text-xs">{message}</p>
    </div>
  )
}
